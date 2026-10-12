package fans.echoes.client.ui.story

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import fans.echoes.client.data.api.Story
import fans.echoes.client.data.api.userMessage
import fans.echoes.client.data.repo.AccountRepository
import fans.echoes.client.data.repo.PaymentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Mirrors the reasons the API accepts, in the order the web shows them. */
val REPORT_REASONS: List<Pair<String, String>> = listOf(
    "sexual_content" to "Sexual content",
    "violence_or_hate" to "Violence or hate",
    "illegal_activity" to "Illegal activity",
    "harassment" to "Harassment",
    "impersonation" to "Impersonation",
    "spam_or_scam" to "Spam or scam",
    "other" to "Something else",
)

data class StoryUiState(
    val favourite: Boolean = false,
    val alreadyEvaluated: Boolean = false,
    val audioQuality: Int = 4,
    val storytelling: Int = 4,
    val descriptionAccuracy: Int = 4,
    val submitting: Boolean = false,
    val submitted: Boolean = false,
    val unlocking: Boolean = false,
    val reportOpen: Boolean = false,
    val reportReason: String = REPORT_REASONS.first().first,
    val reportDetails: String = "",
    val reporting: Boolean = false,
    val reported: Boolean = false,
    /** Set once a paid recording has been unlocked; carries the playable audio. */
    val unlockedStory: Story? = null,
    val error: String? = null,
)

class StoryViewModel : ViewModel() {

    private val _state = MutableStateFlow(StoryUiState())
    val state: StateFlow<StoryUiState> = _state.asStateFlow()

    private var loadedStoryId: String? = null

    fun load(storyId: String) {
        if (loadedStoryId == storyId) return
        loadedStoryId = storyId
        _state.value = StoryUiState()
        viewModelScope.launch {
            val favourites = AccountRepository.favourites()
            val evaluated = AccountRepository.evaluatedStoryIds()
            _state.update {
                it.copy(
                    favourite = storyId in favourites,
                    alreadyEvaluated = storyId in evaluated,
                )
            }
        }
    }

    fun toggleFavourite(storyId: String, wallet: String) {
        viewModelScope.launch {
            runCatching { AccountRepository.toggleFavourite(storyId, wallet) }
                .onSuccess { isFav -> _state.update { it.copy(favourite = isFav) } }
                .onFailure { e -> _state.update { it.copy(error = e.userMessage()) } }
        }
    }

    /**
     * Pays for a private recording. The wallet submits the transfer the server
     * built; access is granted only after the server verifies it on-chain.
     */
    fun unlock(story: Story, wallet: String, sender: ActivityResultSender) {
        if (_state.value.unlocking) return
        _state.update { it.copy(unlocking = true, error = null) }
        viewModelScope.launch {
            when (val outcome = PaymentRepository.unlock(story, wallet, sender)) {
                is PaymentRepository.Outcome.Unlocked ->
                    _state.update { it.copy(unlocking = false, unlockedStory = outcome.story) }

                PaymentRepository.Outcome.Cancelled ->
                    _state.update { it.copy(unlocking = false) }

                PaymentRepository.Outcome.NoWallet ->
                    _state.update { it.copy(unlocking = false, error = "No compatible wallet found on this device.") }

                is PaymentRepository.Outcome.Failed ->
                    _state.update { it.copy(unlocking = false, error = outcome.message) }
            }
        }
    }

    fun openReport(open: Boolean) = _state.update { it.copy(reportOpen = open, error = null) }
    fun setReportReason(value: String) = _state.update { it.copy(reportReason = value) }
    fun setReportDetails(value: String) = _state.update { it.copy(reportDetails = value.take(1000)) }

    /** Sends a content report; the store policy requires this path to exist. */
    fun submitReport(storyId: String) {
        val snapshot = _state.value
        if (snapshot.reporting || snapshot.reported) return
        _state.update { it.copy(reporting = true, error = null) }
        viewModelScope.launch {
            runCatching {
                AccountRepository.report(storyId, snapshot.reportReason, snapshot.reportDetails)
            }.onSuccess {
                _state.update { it.copy(reporting = false, reported = true, reportOpen = false) }
            }.onFailure { e ->
                _state.update { it.copy(reporting = false, error = e.userMessage()) }
            }
        }
    }

    fun setAudioQuality(value: Int) = _state.update { it.copy(audioQuality = value) }
    fun setStorytelling(value: Int) = _state.update { it.copy(storytelling = value) }
    fun setDescriptionAccuracy(value: Int) = _state.update { it.copy(descriptionAccuracy = value) }
    fun dismissError() = _state.update { it.copy(error = null) }

    /**
     * Sends the review. [listenedPercent] is measured from actual playback, so a
     * story rated without listening is recorded as exactly that.
     */
    fun submitEvaluation(storyId: String, wallet: String, listenedPercent: Double) {
        val snapshot = _state.value
        if (snapshot.submitting || snapshot.alreadyEvaluated) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            runCatching {
                AccountRepository.submitEvaluation(
                    storyId = storyId,
                    wallet = wallet,
                    audioQuality = snapshot.audioQuality,
                    storytelling = snapshot.storytelling,
                    descriptionAccuracy = snapshot.descriptionAccuracy,
                    listenedPercent = listenedPercent,
                )
            }.onSuccess {
                _state.update { it.copy(submitting = false, submitted = true, alreadyEvaluated = true) }
            }.onFailure { e ->
                _state.update { it.copy(submitting = false, error = e.userMessage()) }
            }
        }
    }
}
