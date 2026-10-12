package fans.echoes.client.data.repo

import android.util.Base64
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.DefaultTransactionParams
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import fans.echoes.client.data.api.Api
import fans.echoes.client.data.api.Story
import fans.echoes.client.data.api.UnlockRequest
import fans.echoes.client.data.auth.Base58
import fans.echoes.client.data.auth.WalletAuth

/**
 * Paying for a private recording.
 *
 * The server builds the transfer, the wallet signs and submits it, and the server
 * then verifies the signature on-chain before granting access. The client never
 * constructs a transaction or decides an amount — that boundary is deliberate.
 */
object PaymentRepository {

    sealed interface Outcome {
        data class Unlocked(val story: Story) : Outcome
        data object Cancelled : Outcome
        data object NoWallet : Outcome
        data class Failed(val message: String) : Outcome
    }

    /**
     * Pays the listing fee so a story publishes immediately instead of waiting
     * for community review. Returns the transaction signature the story record
     * must carry; the server re-verifies it on-chain before listing anything.
     */
    suspend fun payListingFee(wallet: String, sender: ActivityResultSender): Outcome2<String> {
        val unsigned = runCatching { Api.service.listingTransaction(wallet) }
            .getOrElse { return Outcome2.Failed(it.message ?: "Could not prepare the listing payment") }

        val payloads = unsigned.transactions
            .map { Base64.decode(it, Base64.DEFAULT) }
            .toTypedArray()
        if (payloads.isEmpty()) return Outcome2.Failed("The server returned no transaction to sign")

        val adapter = WalletAuth.adapter()

        val result = WalletAuth.holdAwake {
            adapter.transact(sender) {
                val signed = signAndSendTransactions(payloads, DefaultTransactionParams)
                val signature = signed.signatures.firstOrNull()
                    ?: error("The wallet returned no transaction signature")
                Base58.encode(signature)
            }
        }

        return when (result) {
            is TransactionResult.Success -> Outcome2.Done(result.payload)
            is TransactionResult.NoWalletFound -> Outcome2.NoWallet()
            is TransactionResult.Failure ->
                if (WalletAuth.isCancellation(result.message)) Outcome2.Cancelled()
                else Outcome2.Failed(WalletAuth.describeFailure(result.message))
        }
    }

    /** Result of a payment that yields a value, such as a transaction signature. */
    sealed interface Outcome2<out T> {
        data class Done<T>(val value: T) : Outcome2<T>
        class Cancelled : Outcome2<Nothing>
        class NoWallet : Outcome2<Nothing>
        data class Failed(val message: String) : Outcome2<Nothing>
    }

    suspend fun unlock(story: Story, wallet: String, sender: ActivityResultSender): Outcome {
        val unsigned = runCatching { Api.service.unlockTransaction(story.id, wallet) }
            .getOrElse { return Outcome.Failed(it.message ?: "Could not prepare the payment") }

        val payloads = unsigned.transactions
            .map { Base64.decode(it, Base64.DEFAULT) }
            .toTypedArray()
        if (payloads.isEmpty()) return Outcome.Failed("The server returned no transaction to sign")

        val adapter = WalletAuth.adapter()

        val result = WalletAuth.holdAwake {
            adapter.transact(sender) {
                val signed = signAndSendTransactions(payloads, DefaultTransactionParams)
                val signature = signed.signatures.firstOrNull()
                    ?: error("The wallet returned no transaction signature")
                Base58.encode(signature)
            }
        }

        return when (result) {
            is TransactionResult.Success -> {
                val signature = result.payload
                runCatching {
                    Api.service.confirmUnlock(
                        UnlockRequest(storyId = story.id, wallet = wallet, txSig = signature),
                    )
                    // Re-reading the story is what proves access: the API only
                    // returns the audio URL once the unlock is recorded.
                    Api.service.story(story.id)
                }.fold(
                    onSuccess = { Outcome.Unlocked(it) },
                    onFailure = {
                        Outcome.Failed(
                            "The payment went through, but access was not granted yet: " +
                                (it.message ?: "unknown error"),
                        )
                    },
                )
            }

            is TransactionResult.NoWalletFound -> Outcome.NoWallet
            is TransactionResult.Failure -> {
                val message = result.message
                if (WalletAuth.isCancellation(message)) Outcome.Cancelled
                else Outcome.Failed(WalletAuth.describeFailure(message))
            }
        }
    }
}
