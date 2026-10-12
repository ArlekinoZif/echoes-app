package fans.echoes.client.data.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/**
 * Records a story to an AAC/MP4 file in the app cache.
 *
 * MP4/AAC is chosen because Android records it natively and the upload endpoint
 * accepts `audio/mp4`; no transcoding is needed on either side.
 */
class AudioRecorder(private val context: Context) {

    class RecordingFailed(message: String, cause: Throwable? = null) : Exception(message, cause)

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startedAt: Long = 0
    private var pausedAt: Long = 0
    private var pausedTotal: Long = 0

    val isRecording: Boolean get() = recorder != null
    var isPaused: Boolean = false
        private set

    fun start() {
        if (recorder != null) return
        val file = File(context.cacheDir, "story-${System.currentTimeMillis()}.m4a")
        val instance = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        try {
            instance.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(96_000)
                setAudioSamplingRate(44_100)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
        } catch (e: Exception) {
            runCatching { instance.release() }
            file.delete()
            throw RecordingFailed("The microphone could not be started", e)
        }
        recorder = instance
        outputFile = file
        startedAt = System.currentTimeMillis()
        pausedTotal = 0
        isPaused = false
    }

    /** Holds the take without ending it; the file keeps growing after [resume]. */
    fun pause() {
        val instance = recorder ?: return
        if (isPaused) return
        runCatching { instance.pause() }.onSuccess {
            isPaused = true
            pausedAt = System.currentTimeMillis()
        }
    }

    fun resume() {
        val instance = recorder ?: return
        if (!isPaused) return
        runCatching { instance.resume() }.onSuccess {
            isPaused = false
            pausedTotal += System.currentTimeMillis() - pausedAt
        }
    }

    /** Recorded time only: pauses do not count towards the ten-minute limit. */
    private fun recordedMillis(): Long {
        val now = if (isPaused) pausedAt else System.currentTimeMillis()
        return now - startedAt - pausedTotal
    }

    /** Returns the finished recording, or null when nothing usable was captured. */
    fun stop(): Recording? {
        val instance = recorder ?: return null
        val file = outputFile
        recorder = null
        outputFile = null

        val durationMs = recordedMillis()
        isPaused = false
        val stoppedCleanly = runCatching { instance.stop() }.isSuccess
        runCatching { instance.release() }

        if (!stoppedCleanly || file == null || !file.exists() || file.length() == 0L) {
            file?.delete()
            return null
        }
        return Recording(file = file, durationSeconds = (durationMs / 1000).toInt().coerceAtLeast(1))
    }

    fun cancel() {
        val file = outputFile
        runCatching { recorder?.stop() }
        runCatching { recorder?.release() }
        recorder = null
        outputFile = null
        isPaused = false
        file?.delete()
    }

    /** Loudness since the last call, 0..1, on a perceptual (log) scale. */
    fun level(): Float {
        if (isPaused) return 0f
        val raw = runCatching { recorder?.maxAmplitude ?: 0 }.getOrDefault(0)
        if (raw <= 0) return 0f
        val db = 20 * kotlin.math.log10(raw / 32767.0)
        return ((db + 50) / 50).toFloat().coerceIn(0f, 1f)
    }

    fun elapsedSeconds(): Int =
        if (recorder == null) 0 else (recordedMillis() / 1000).toInt()

    data class Recording(val file: File, val durationSeconds: Int)
}
