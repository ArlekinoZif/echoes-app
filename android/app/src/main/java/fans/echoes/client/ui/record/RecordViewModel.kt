package fans.echoes.client.ui.record

import android.app.Application
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import fans.echoes.client.data.api.Story
import fans.echoes.client.data.api.userMessage
import fans.echoes.client.data.audio.AudioRecorder
import fans.echoes.client.data.cover.CoverArt
import fans.echoes.client.data.repo.PaymentRepository
import fans.echoes.client.data.repo.StoryRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

/** Longest story the API accepts. */
const val MAX_SECONDS = 600

private const val LEVEL_HISTORY = 48

enum class RecordStage { Idle, Recording, Paused, Review, Publishing, Published }

/** Free community review, or pay the listing fee and publish at once. */
enum class PublishMode { Review, PayNow }

data class RecordUiState(
    val stage: RecordStage = RecordStage.Idle,
    val elapsedSeconds: Int = 0,
    val durationSeconds: Int = 0,
    val title: String = "",
    val description: String = "",
    val category: String = "Other",
    val error: String? = null,
    val publishedStory: Story? = null,
    val publishMode: PublishMode = PublishMode.Review,
    val paying: Boolean = false,
    /** A picture the person chose, copied into app storage. Null means "generate one". */
    val coverPath: String? = null,
    /** Seed for the generated cover, fixed per take so it does not change while typing. */
    val coverSeed: Long = 0L,
    /** A take just ended: the arm is lifting off the record before the sleeve comes. */
    val finishing: Boolean = false,
    /** The sleeve should arrive and pack the record (not after a restart). */
    val introPending: Boolean = false,
) {
    val isTakeRunning: Boolean get() = stage == RecordStage.Recording || stage == RecordStage.Paused

    val canPublish: Boolean
        get() = stage == RecordStage.Review &&
            title.trim().length in 1..80 &&
            description.trim().length in 1..500 &&
            durationSeconds in 1..MAX_SECONDS

    companion object {
        val CATEGORIES = listOf(
            "War", "Love", "Immigration", "Entrepreneurship", "Family", "Survival", "Other",
        )
    }
}

class RecordViewModel(app: Application) : AndroidViewModel(app) {

    private val recorder = AudioRecorder(app)
    private var recording: File? = null

    /**
     * A finished recording outlives this view model: the wallet takes over the
     * screen during payment, and leaving the app must not throw away what the
     * person just recorded.
     */
    private val pending = app.getSharedPreferences("echoes-pending-recording", Application.MODE_PRIVATE)

    private val _state = MutableStateFlow(RecordUiState())
    val state: StateFlow<RecordUiState> = _state.asStateFlow()

    /**
     * The last few seconds of microphone loudness, newest last, for the live
     * waveform. Kept apart from [state] so 16 updates a second redraw only the
     * waveform, not the whole screen.
     */
    private val _levels = MutableStateFlow(List(LEVEL_HISTORY) { 0f })
    val levels: StateFlow<List<Float>> = _levels.asStateFlow()

    init { restorePending() }

    private fun restorePending() {
        val path = pending.getString("path", null) ?: return
        val file = File(path)
        val seconds = pending.getInt("durationSeconds", 0)
        if (!file.exists() || file.length() == 0L || seconds <= 0) {
            clearPending()
            return
        }
        recording = file
        _state.update {
            it.copy(
                stage = RecordStage.Review,
                durationSeconds = seconds,
                title = pending.getString("title", "").orEmpty(),
                description = pending.getString("description", "").orEmpty(),
                category = pending.getString("category", "Other").orEmpty(),
                coverPath = pending.getString("coverPath", null)?.takeIf { p -> File(p).exists() },
                coverSeed = pending.getLong("coverSeed", file.name.hashCode().toLong()),
            )
        }
    }

    private fun savePending() {
        val file = recording ?: return
        val snapshot = _state.value
        pending.edit()
            .putString("path", file.absolutePath)
            .putInt("durationSeconds", snapshot.durationSeconds)
            .putString("title", snapshot.title)
            .putString("description", snapshot.description)
            .putString("category", snapshot.category)
            .putString("coverPath", snapshot.coverPath)
            .putLong("coverSeed", snapshot.coverSeed)
            .apply()
    }

    private fun clearPending() = pending.edit().clear().apply()

    fun start() {
        if (_state.value.isTakeRunning) return
        try {
            recorder.start()
        } catch (e: AudioRecorder.RecordingFailed) {
            _state.update { it.copy(error = e.message) }
            return
        }
        _state.update { it.copy(stage = RecordStage.Recording, error = null, elapsedSeconds = 0) }

        viewModelScope.launch {
            while (recorder.isRecording) {
                _levels.value = _levels.value.drop(1) + recorder.level()
                delay(60)
            }
            _levels.value = List(LEVEL_HISTORY) { 0f }
        }

        viewModelScope.launch {
            while (recorder.isRecording) {
                val elapsed = recorder.elapsedSeconds()
                _state.update { it.copy(elapsedSeconds = elapsed) }
                if (elapsed >= MAX_SECONDS) {
                    stop()
                    break
                }
                delay(500)
            }
        }
    }

    /** Holds the take; the platter stops and the timer freezes. */
    fun pause() {
        if (_state.value.stage != RecordStage.Recording) return
        recorder.pause()
        if (recorder.isPaused) _state.update { it.copy(stage = RecordStage.Paused) }
    }

    fun resume() {
        if (_state.value.stage != RecordStage.Paused) return
        recorder.resume()
        if (!recorder.isPaused) _state.update { it.copy(stage = RecordStage.Recording) }
    }

    fun stop() {
        val result = recorder.stop()
        if (result == null) {
            _state.update {
                it.copy(stage = RecordStage.Idle, error = "Nothing was recorded — check the microphone.")
            }
            return
        }
        recording = result.file
        _state.update {
            it.copy(
                stage = RecordStage.Review,
                durationSeconds = result.durationSeconds,
                error = null,
                coverSeed = System.currentTimeMillis(),
                finishing = true,
                introPending = true,
            )
        }
        savePending()
    }

    fun discard() {
        recorder.cancel()
        recording?.delete()
        _state.value.coverPath?.let { File(it).delete() }
        recording = null
        clearPending()
        _state.value = RecordUiState()
    }

    fun setTitle(value: String) {
        _state.update { it.copy(title = value.take(80)) }
        savePending()
    }

    fun setDescription(value: String) {
        _state.update { it.copy(description = value.take(500)) }
        savePending()
    }

    fun setCategory(value: String) {
        _state.update { it.copy(category = value) }
        savePending()
    }
    /** Takes the person's picture as the cover (already squared and scaled). */
    fun setCover(bitmap: android.graphics.Bitmap) {
        val app = getApplication<Application>()
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            val file = File(app.filesDir, "cover-${System.currentTimeMillis()}.jpg")
            runCatching { file.writeBytes(CoverArt.toJpeg(bitmap)) }.onSuccess {
                _state.value.coverPath?.let { old -> File(old).delete() }
                _state.update { it.copy(coverPath = file.absolutePath) }
                savePending()
            }
        }
    }

    /** Back to a generated cover; each press draws a new one. */
    fun useGeneratedCover() {
        _state.value.coverPath?.let { File(it).delete() }
        _state.update { it.copy(coverPath = null, coverSeed = it.coverSeed + 7919) }
        savePending()
    }

    fun armLifted() = _state.update { it.copy(finishing = false) }
    fun introShown() = _state.update { it.copy(introPending = false) }

    /** After the "pressed" animation: back to an empty deck, ready for the next story. */
    fun finishPublished() {
        _state.value = RecordUiState()
    }

    fun setPublishMode(mode: PublishMode) = _state.update { it.copy(publishMode = mode) }
    fun dismissError() = _state.update { it.copy(error = null) }

    fun publish(ownerId: String, sender: ActivityResultSender?) {
        val file = recording ?: return
        val snapshot = _state.value
        if (!snapshot.canPublish) return

        _state.update { it.copy(stage = RecordStage.Publishing, error = null) }
        viewModelScope.launch {
            // Paying first: a story is only listed immediately when the server can
            // verify the fee transaction, so there is no point uploading before it.
            var listingTxSig: String? = null
            if (snapshot.publishMode == PublishMode.PayNow) {
                if (sender == null) {
                    _state.update { it.copy(stage = RecordStage.Review, error = "No wallet is available to pay with.") }
                    return@launch
                }
                _state.update { it.copy(paying = true) }
                when (val outcome = PaymentRepository.payListingFee(ownerId, sender)) {
                    is PaymentRepository.Outcome2.Done -> listingTxSig = outcome.value
                    is PaymentRepository.Outcome2.Cancelled -> {
                        _state.update { it.copy(stage = RecordStage.Review, paying = false) }
                        return@launch
                    }
                    is PaymentRepository.Outcome2.NoWallet -> {
                        _state.update {
                            it.copy(stage = RecordStage.Review, paying = false, error = "No compatible wallet found on this device.")
                        }
                        return@launch
                    }
                    is PaymentRepository.Outcome2.Failed -> {
                        _state.update { it.copy(stage = RecordStage.Review, paying = false, error = outcome.message) }
                        return@launch
                    }
                }
                _state.update { it.copy(paying = false) }
            }

            runCatching {
                val audioUrl = StoryRepository.uploadAudio(file)
                // The cover is a courtesy: a failed upload publishes without one.
                val coverUrl = runCatching {
                    val bytes = snapshot.coverPath?.let { File(it).readBytes() }
                        ?: kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
                            CoverArt.toJpeg(CoverArt.generate(snapshot.coverSeed))
                        }
                    StoryRepository.uploadImage(bytes, "cover-${file.nameWithoutExtension}.jpg", "image/jpeg")
                }.getOrNull()
                StoryRepository.publish(
                    ownerId = ownerId,
                    title = snapshot.title,
                    description = snapshot.description,
                    category = snapshot.category,
                    audioUrl = audioUrl,
                    durationSeconds = snapshot.durationSeconds,
                    coverImageUrl = coverUrl,
                    listingTxSig = listingTxSig,
                )
            }.onSuccess { story ->
                file.delete()
                snapshot.coverPath?.let { File(it).delete() }
                recording = null
                clearPending()
                _state.update { it.copy(stage = RecordStage.Published, publishedStory = story) }
            }.onFailure { e ->
                _state.update { it.copy(stage = RecordStage.Review, error = e.userMessage()) }
            }
        }
    }

    override fun onCleared() {
        // Cancels an in-progress recording only; a finished one stays on disk and
        // is restored the next time this screen opens.
        recorder.cancel()
        super.onCleared()
    }
}
