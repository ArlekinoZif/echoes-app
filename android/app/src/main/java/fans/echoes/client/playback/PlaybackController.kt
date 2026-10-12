package fans.echoes.client.playback

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import fans.echoes.client.data.api.ApiConfig
import fans.echoes.client.data.api.Story
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class PlaybackState(
    val storyId: String? = null,
    val playing: Boolean = false,
    val buffering: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
)

/**
 * Single connection to [PlaybackService], shared by every screen so the player
 * survives navigation and the notification always reflects what is audible.
 */
object PlaybackController {

    private var controller: MediaController? = null
    private val _state = MutableStateFlow(PlaybackState())
    val state: StateFlow<PlaybackState> = _state.asStateFlow()

    fun connect(context: Context) {
        if (controller != null) return
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context.applicationContext, token).buildAsync()
        future.addListener({
            controller = future.get().also { it.addListener(PlayerListener) }
            publish()
        }, MoreExecutors.directExecutor())
    }

    fun play(story: Story) {
        val player = controller ?: return
        val url = story.playbackUrl() ?: return
        if (_state.value.storyId == story.id) {
            if (player.isPlaying) player.pause() else player.play()
            return
        }
        player.setMediaItem(
            MediaItem.Builder()
                .setMediaId(story.id)
                .setUri(url)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(story.title)
                        .setArtist(story.authorTwitter?.let { "@$it" } ?: story.category)
                        .setArtworkUri(story.coverImageUrl?.let { android.net.Uri.parse(it) })
                        .build(),
                )
                .build(),
        )
        player.prepare()
        player.play()
        _state.value = _state.value.copy(storyId = story.id)
    }

    fun seekTo(positionMs: Long) = controller?.seekTo(positionMs)

    /** Moves the current story by [deltaMs] (negative rewinds), within its length. */
    fun seekBy(deltaMs: Long) {
        val player = controller ?: return
        val duration = player.duration.takeIf { it > 0 } ?: Long.MAX_VALUE
        player.seekTo((player.currentPosition + deltaMs).coerceIn(0L, duration))
        publish()
    }

    fun pause() = controller?.pause()

    fun release() {
        controller?.removeListener(PlayerListener)
        controller?.release()
        controller = null
    }

    /** Called from the UI on a timer while a story is playing. */
    fun refreshProgress() = publish()

    private fun publish() {
        val player = controller ?: return
        _state.value = PlaybackState(
            storyId = player.currentMediaItem?.mediaId,
            playing = player.isPlaying,
            buffering = player.playbackState == Player.STATE_BUFFERING,
            positionMs = player.currentPosition.coerceAtLeast(0),
            durationMs = player.duration.takeIf { it > 0 } ?: 0,
        )
    }

    private object PlayerListener : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = publish()
    }
}

/** Relative audio paths are served by the API host; absolute ones are used as-is. */
fun Story.playbackUrl(): String? {
    if (audioBlobUrl.isBlank()) return null
    return if (audioBlobUrl.startsWith("http")) audioBlobUrl
    else ApiConfig.baseUrl.trimEnd('/') + "/" + audioBlobUrl.trimStart('/')
}
