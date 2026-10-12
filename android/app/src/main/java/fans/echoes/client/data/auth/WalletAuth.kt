package fans.echoes.client.data.auth

import android.net.Uri
import android.util.Base64
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.ConnectionIdentity
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.Solana
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import com.solana.mobilewalletadapter.common.signin.SignInWithSolana
import fans.echoes.client.data.SeekerDevice
import fans.echoes.client.data.api.Api
import fans.echoes.client.data.api.ApiConfig
import fans.echoes.client.data.api.ChallengeRequest
import fans.echoes.client.data.api.VerifyRequest
import fans.echoes.client.data.api.userMessage

/**
 * Signs in with the wallet the device already trusts. On a Seeker that is Seed
 * Vault; on any other Android device it is whichever Mobile Wallet Adapter
 * wallet is installed.
 *
 * The exchange mirrors the web flow exactly: ask the server for a one-time
 * message, have the wallet sign it, and hand the signature back. The server
 * replies with the session cookie, which [Api]'s cookie jar persists.
 */
object WalletAuth {

    sealed interface Outcome {
        data class SignedIn(val address: String) : Outcome
        data object NoWallet : Outcome
        data class Failed(val message: String) : Outcome
    }

    /** Shared with the payment flow so the wallet shows one identity for Echoes. */
    val identity = ConnectionIdentity(
        // The wallet shows and verifies the product's domain, not the API path.
        identityUri = Uri.parse(fans.echoes.client.BuildConfig.SITE_URL),
        iconUri = Uri.parse("icon.png"),
        identityName = "Echoes",
    )

    private lateinit var appContext: android.content.Context

    fun init(context: android.content.Context) {
        appContext = context.applicationContext
    }

    /** Runs a wallet exchange with the process kept unfrozen; see [WalletSessionService]. */
    suspend fun <T> holdAwake(block: suspend () -> T): T =
        if (::appContext.isInitialized) WalletSessionService.hold(appContext, block) else block()

    /** Kept between sessions so the wallet does not re-prompt on every launch. */
    @Volatile
    var authToken: String? = null
        private set

    /**
     * Every wallet session goes through here. The adapter library defaults to
     * devnet, which a real wallet rejects for a mainnet app ("trying to use a
     * testnet"); the mock wallet on the emulator accepts either, so this only
     * shows on a phone with Phantom, Solflare or Seed Vault.
     */
    fun adapter(): MobileWalletAdapter =
        MobileWalletAdapter(connectionIdentity = identity).apply {
            blockchain = Solana.Mainnet
            WalletAuth.authToken?.let { authToken = it }
        }

    suspend fun signIn(sender: ActivityResultSender): Outcome {
        val adapter = adapter()
        val device = SeekerDevice.info(appContext)

        // Sign In With Solana first: one wallet prompt instead of connect + sign,
        // and the flow Solana Mobile recommends for Seed Vault. The payload comes
        // from the server so it owns the nonce and the domain.
        val siws = runCatching {
            retryingNetwork { Api.service.challenge(ChallengeRequest(mode = "siws")).siws }
        }.getOrNull()
        val payload = siws?.let {
            SignInWithSolana.Payload(
                it.domain, null as String?, it.statement, Uri.parse(it.uri), it.version, it.chainId,
                it.nonce, it.issuedAt, it.expirationTime, null, null, null,
            )
        }

        val result = holdAwake { adapter.transact(sender, payload) { authResult ->
            val signIn = authResult.signInResult
            if (signIn != null) {
                val address = Base58.encode(signIn.publicKey)
                retryingNetwork {
                    Api.service.verify(
                        VerifyRequest(
                            address = address,
                            signature = Base64.encodeToString(signIn.signature, Base64.NO_WRAP),
                            signedMessage = Base64.encodeToString(signIn.signedMessage, Base64.NO_WRAP),
                            device = device,
                        ),
                    )
                }
                return@transact address
            }

            // A wallet without Sign In With Solana: sign the server's own message
            // in the same session, as before.
            val address = Base58.encode(authResult.publicKey)
            val challenge = retryingNetwork { Api.service.challenge(ChallengeRequest(address = address)) }
            val message = challenge.message ?: error("The server returned no sign-in message")
            val signed = signMessagesDetached(
                arrayOf(message.toByteArray(Charsets.UTF_8)),
                arrayOf(authResult.publicKey),
            )
            val signature = signed.messages.firstOrNull()?.signatures?.firstOrNull()
                ?: error("The wallet returned no signature")

            retryingNetwork {
                Api.service.verify(
                    VerifyRequest(
                        address = address,
                        signature = Base64.encodeToString(signature, Base64.NO_WRAP),
                        device = device,
                    ),
                )
            }
            address
        } }

        return when (result) {
            is TransactionResult.Success -> {
                authToken = result.authResult.authToken
                Outcome.SignedIn(result.payload)
            }
            is TransactionResult.NoWalletFound -> Outcome.NoWallet
            is TransactionResult.Failure -> Outcome.Failed(
                // A failed call to our own API inside the wallet session (no
                // network, server error) reads better through the API's wording.
                (result.e.causeChain().firstOrNull { it is java.io.IOException || it is retrofit2.HttpException }
                    ?.userMessage())
                    ?: describeFailure(result.message),
            )
        }
    }

    /** True when the person closed or declined the wallet prompt themselves. */
    fun isCancellation(message: String): Boolean =
        message.contains("cancel", ignoreCase = true) ||
            message.contains("declin", ignoreCase = true)

    /**
     * Turns the adapter's protocol-level failure text into something a person can
     * act on. "Failed establishing local association" is what the library reports
     * when the wallet app did not open its session in time, which in practice
     * means it was slow to start or was closed before it answered.
     */
    fun describeFailure(message: String): String = when {
        message.contains("association", ignoreCase = true) ||
            message.contains("timed out", ignoreCase = true) ||
            message.contains("timeout", ignoreCase = true) ->
            "The wallet did not respond in time. Open it once, then try again."
        isCancellation(message) -> "The request was cancelled in the wallet."
        else -> message
    }

    /**
     * The wallet has already been approved when these calls run, so a momentary
     * network drop (a DNS miss while switching networks) must not throw the
     * approval away. Only I/O failures are retried; HTTP errors are final.
     */
    private suspend fun <T> retryingNetwork(block: suspend () -> T): T {
        var delayMs = 400L
        repeat(3) {
            try {
                return block()
            } catch (e: java.io.IOException) {
                kotlinx.coroutines.delay(delayMs)
                delayMs *= 2
            }
        }
        return block()
    }

    private fun Throwable.causeChain(): Sequence<Throwable> = generateSequence(this) { it.cause }

    suspend fun signOut() {
        runCatching { Api.service.logout() }
        Api.cookieJar.clear()
        authToken = null
    }
}
