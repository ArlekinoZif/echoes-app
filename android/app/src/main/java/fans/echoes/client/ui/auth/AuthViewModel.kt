package fans.echoes.client.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import fans.echoes.client.data.api.Api
import fans.echoes.client.data.auth.WalletAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import fans.echoes.client.data.api.userMessage
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

data class AuthUiState(
    val checking: Boolean = true,
    val signingIn: Boolean = false,
    val address: String? = null,
    val error: String? = null,
    val walletMissing: Boolean = false,
) {
    val signedIn: Boolean get() = address != null
}

class AuthViewModel : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    init { restoreSession() }

    /** The session cookie outlives the process, so a launch can skip the wallet. */
    private fun restoreSession() {
        viewModelScope.launch {
            // A network blip at launch must not look like "signed out": the
            // stored session is still valid, so retry before giving up on it.
            // Bounded, because the splash screen stays up until this finishes.
            var result: Result<fans.echoes.client.data.api.AuthState> =
                Result.failure(java.net.SocketTimeoutException())
            withTimeoutOrNull(STARTUP_CHECK_MS) {
                var delayMs = 500L
                result = runCatching { Api.service.session() }
                repeat(3) {
                    if (result.exceptionOrNull() !is java.io.IOException) return@repeat
                    kotlinx.coroutines.delay(delayMs)
                    delayMs *= 2
                    result = runCatching { Api.service.session() }
                }
            }
            val address = result.getOrNull()?.takeIf { it.authenticated }?.address
            val offline = result.exceptionOrNull() is java.io.IOException
            _state.update {
                it.copy(
                    checking = false,
                    address = address,
                    error = if (offline) result.exceptionOrNull()?.userMessage() else null,
                )
            }
        }
    }

    fun signIn(sender: ActivityResultSender) {
        if (_state.value.signingIn) return
        _state.update { it.copy(signingIn = true, error = null, walletMissing = false) }
        viewModelScope.launch {
            // A wallet can drop the session without answering (seen with Phantom
            // when its Connect sheet is left open); the adapter then never resolves.
            // The timeout guarantees the button comes back.
            // The adapter may block a thread while it waits, so the attempt runs as
            // its own job and only the wait for it is bounded.
            val attempt = viewModelScope.async {
                runCatching { WalletAuth.signIn(sender) }.getOrElse {
                    WalletAuth.Outcome.Failed(it.userMessage())
                }
            }
            val outcome = withTimeoutOrNull(WALLET_TIMEOUT_MS) { attempt.await() }
                ?: WalletAuth.Outcome.Failed("The wallet did not answer. Tap to try again.")
            when (outcome) {
                is WalletAuth.Outcome.SignedIn ->
                    _state.update { it.copy(signingIn = false, address = outcome.address) }

                WalletAuth.Outcome.NoWallet ->
                    _state.update { it.copy(signingIn = false, walletMissing = true) }

                is WalletAuth.Outcome.Failed ->
                    _state.update { it.copy(signingIn = false, error = outcome.message) }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            WalletAuth.signOut()
            _state.update { it.copy(address = null) }
        }
    }

    fun dismissError() = _state.update { it.copy(error = null, walletMissing = false) }
}

/** Longer than any wallet prompt a person reads, shorter than giving up on the app. */
private const val WALLET_TIMEOUT_MS = 150_000L

/** How long the splash screen may wait for the session check before showing the app. */
private const val STARTUP_CHECK_MS = 8_000L
