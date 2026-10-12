package fans.echoes.client.ui.story

import android.content.Intent
import fans.echoes.client.data.StoryLinks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.animation.togetherWith
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import fans.echoes.client.data.api.Story
import fans.echoes.client.playback.PlaybackController
import fans.echoes.client.playback.playbackUrl
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandGoldDim
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.GoldButton
import fans.echoes.client.ui.theme.BrandSurface
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.ScreenPadding
import fans.echoes.client.ui.theme.GlassCard
import fans.echoes.client.ui.theme.brandFieldColors
import kotlinx.coroutines.delay

@Composable
fun StoryScreen(
    story: Story,
    wallet: String,
    walletSender: ActivityResultSender?,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: StoryViewModel = viewModel(),
) {
    val playback by PlaybackController.state.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isCurrent = playback.storyId == story.id

    // How much of the recording was actually heard, used by the review.
    var furthestPositionMs by remember(story.id) { mutableLongStateOf(0L) }
    if (isCurrent && playback.positionMs > furthestPositionMs) furthestPositionMs = playback.positionMs
    val totalMs = (if (isCurrent && playback.durationMs > 0) playback.durationMs
    else story.durationSeconds.toLong() * 1000).coerceAtLeast(1)
    val listenedPercent = (furthestPositionMs.toDouble() / totalMs * 100).coerceIn(0.0, 100.0)

    LaunchedEffect(story.id) { viewModel.load(story.id) }

    // Scrubbing by turning the record: the slider follows the finger at once, the
    // player seeks when the finger pauses, so streaming is not asked to seek on
    // every frame of the gesture.
    var scrubMs by remember(story.id) { androidx.compose.runtime.mutableStateOf<Long?>(null) }
    LaunchedEffect(scrubMs) {
        val target = scrubMs ?: return@LaunchedEffect
        delay(140)
        PlaybackController.seekTo(target)
        delay(400)
        scrubMs = null
    }

    // After a successful unlock the API returns the same story with its audio.
    @Suppress("NAME_SHADOWING")
    val story = state.unlockedStory?.takeIf { it.id == story.id } ?: story

    // The controller reports position on events only; a story plays for minutes,
    // so the scrubber is refreshed while it is the audible one.
    LaunchedEffect(isCurrent, playback.playing) {
        while (isCurrent && playback.playing) {
            PlaybackController.refreshProgress()
            delay(500)
        }
    }

    Column(modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(8.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = BrandTextMuted)
            }
            Text(
                "Records library",
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
                modifier = Modifier.weight(1f),
            )
            if (StoryLinks.isShareable(story)) {
                val context = LocalContext.current
                IconButton(onClick = {
                    val send = Intent(Intent.ACTION_SEND)
                        .setType("text/plain")
                        .putExtra(Intent.EXTRA_SUBJECT, story.title)
                        .putExtra(Intent.EXTRA_TEXT, StoryLinks.url(story))
                    context.startActivity(Intent.createChooser(send, null))
                }) {
                    Icon(Icons.Filled.Share, contentDescription = "Share", tint = BrandTextMuted)
                }
            }
            IconButton(onClick = { viewModel.openReport(!state.reportOpen) }) {
                Icon(
                    Icons.Filled.Flag,
                    contentDescription = "Report this recording",
                    tint = if (state.reportOpen) BrandGold else BrandTextMuted,
                )
            }
            IconButton(
                onClick = { if (wallet.isNotBlank()) viewModel.toggleFavourite(story.id, wallet) },
            ) {
                Icon(
                    if (state.favourite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = if (state.favourite) "Remove from favourites" else "Add to favourites",
                    tint = if (state.favourite) BrandGold else BrandTextMuted,
                )
            }
        }

        SleeveDeck(
            story = story,
            active = isCurrent,
            playing = isCurrent && playback.playing,
            canPlay = story.playbackUrl() != null,
            onToggle = { PlaybackController.play(story) },
            // Turning the record moves through the story: backwards rewinds.
            onScrub = { degrees ->
                val base = scrubMs ?: playback.positionMs
                scrubMs = (base + (degrees / 360f * MS_PER_TURN).toLong()).coerceIn(0L, totalMs)
            },
            modifier = Modifier.padding(horizontal = 8.dp),
        )

        Column(Modifier.padding(horizontal = ScreenPadding, vertical = 12.dp)) {
            when {
                story.isPrivate && story.playbackUrl() == null -> UnlockBlock(
                    priceSol = story.priceSol,
                    unlocking = state.unlocking,
                    enabled = wallet.isNotBlank() && walletSender != null,
                    onUnlock = { walletSender?.let { viewModel.unlock(story, wallet, it) } },
                )

                story.playbackUrl() == null -> Text(
                    "Audio unavailable for this recording.",
                    style = MaterialTheme.typography.bodySmall,
                    color = BrandTextFaint,
                )

                else -> PlayerBar(
                    story = story,
                    playing = isCurrent && playback.playing,
                    buffering = isCurrent && playback.buffering,
                    positionMs = scrubMs ?: if (isCurrent) playback.positionMs else 0,
                    durationMs = totalMs,
                )
            }

            // The story's words sit under the player, where the eye lands after pressing play.
            Spacer(Modifier.height(22.dp))
            Text(story.title, style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(4.dp))
            Text(
                listOfNotNull(
                    story.category,
                    story.authorTwitter?.let { "@$it" } ?: story.authorWallet?.let { "${it.take(4)}…${it.takeLast(4)}" },
                    story.durationSeconds.takeIf { it > 0 }?.let { formatSeconds(it.toLong() * 1000) },
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
            )

            if (story.description.isNotBlank()) {
                Spacer(Modifier.height(14.dp))
                Text(story.description, style = MaterialTheme.typography.bodyMedium, color = BrandTextMuted)
            }

            if (state.reported) {
                Spacer(Modifier.height(20.dp))
                Text(
                    "Thank you — this recording has been sent for review.",
                    style = MaterialTheme.typography.bodySmall,
                    color = BrandGold,
                )
            }

            if (state.reportOpen && !state.reported) {
                Spacer(Modifier.height(20.dp))
                ReportPanel(
                    state = state,
                    signedIn = wallet.isNotBlank(),
                    onReason = viewModel::setReportReason,
                    onDetails = viewModel::setReportDetails,
                    onSubmit = { viewModel.submitReport(story.id) },
                    onCancel = { viewModel.openReport(false) },
                )
            }

            if (!story.isPrivate && wallet.isNotBlank()) {
                Spacer(Modifier.height(28.dp))
                EvaluationSection(
                    state = state,
                    listenedPercent = listenedPercent,
                    onAudioQuality = viewModel::setAudioQuality,
                    onStorytelling = viewModel::setStorytelling,
                    onDescriptionAccuracy = viewModel::setDescriptionAccuracy,
                    onSubmit = { viewModel.submitEvaluation(story.id, wallet, listenedPercent) },
                )
            }

            state.error?.let { message ->
                Spacer(Modifier.height(12.dp))
                Text(message, color = BrandError, style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = viewModel::dismissError) { Text("Dismiss", color = BrandTextMuted) }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}

/** The reporting path the store policy requires for user-generated media. */
@Composable
private fun ReportPanel(
    state: StoryUiState,
    signedIn: Boolean,
    onReason: (String) -> Unit,
    onDetails: (String) -> Unit,
    onSubmit: () -> Unit,
    onCancel: () -> Unit,
) {
    Column {
        Text("Report this recording", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(4.dp))
        if (!signedIn) {
            Text(
                "Sign in to report a recording.",
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextFaint,
            )
            return
        }
        Text(
            "Why are you reporting it?",
            style = MaterialTheme.typography.bodySmall,
            color = BrandTextFaint,
        )
        Spacer(Modifier.height(10.dp))

        REPORT_REASONS.forEach { (value, label) ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(BrandRadius.lg))
                    .clickable { onReason(value) }
                    .padding(vertical = 8.dp, horizontal = 10.dp),
            ) {
                Box(
                    Modifier
                        .size(16.dp)
                        .clip(RoundedCornerShape(BrandRadius.pill))
                        .background(if (state.reportReason == value) BrandGold else BrandSurface)
                        .border(
                            androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (state.reportReason == value) BrandGold else BrandBorder,
                            ),
                            RoundedCornerShape(BrandRadius.pill),
                        ),
                )
                Spacer(Modifier.size(10.dp))
                Text(
                    label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (state.reportReason == value) BrandText else BrandTextMuted,
                )
            }
        }

        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = state.reportDetails,
            onValueChange = onDetails,
            placeholder = { Text("Anything else we should know? (optional)", color = BrandTextFaint) },
            minLines = 2,
            colors = brandFieldColors(),
            shape = RoundedCornerShape(BrandRadius.xl),
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(12.dp))
        GoldButton(
            text = if (state.reporting) "Sending…" else "Send report",
            onClick = onSubmit,
            enabled = !state.reporting,
            height = 46.dp,
            modifier = Modifier.fillMaxWidth(),
        )
        TextButton(onClick = onCancel, modifier = Modifier.fillMaxWidth()) {
            Text("Cancel", color = BrandTextMuted)
        }
    }
}

/** Paid access to a private recording, settled by the wallet on-chain. */
@Composable
private fun UnlockBlock(
    priceSol: Double?,
    unlocking: Boolean,
    enabled: Boolean,
    onUnlock: () -> Unit,
) {
    Column {
        GoldButton(
            text = when {
                unlocking -> "Waiting for the wallet…"
                priceSol != null -> "Unlock for $priceSol SOL"
                else -> "Unlock this recording"
            },
            onClick = onUnlock,
            enabled = enabled && !unlocking,
            modifier = Modifier.fillMaxWidth(),
            leading = {
                Icon(Icons.Filled.Lock, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                Spacer(Modifier.size(8.dp))
            },
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "The payment goes straight to the author. Your wallet signs it; Echoes verifies it on-chain before the audio plays.",
            style = MaterialTheme.typography.bodySmall,
            color = BrandTextFaint,
        )
    }
}

/**
 * Community review: three scores plus the share of the recording the listener
 * actually heard. Each criterion is its own card with a question, five record
 * buttons and the chosen word; every choice ticks the vibration motor.
 */
@Composable
private fun EvaluationSection(
    state: StoryUiState,
    listenedPercent: Double,
    onAudioQuality: (Int) -> Unit,
    onStorytelling: (Int) -> Unit,
    onDescriptionAccuracy: (Int) -> Unit,
    onSubmit: () -> Unit,
) {
    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current
    Column {
        Row(verticalAlignment = Alignment.Bottom) {
            Text("Review this story", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Text(
                if (state.alreadyEvaluated) "Reviewed" else "Heard ${listenedPercent.toInt()}%",
                style = MaterialTheme.typography.labelMedium,
                color = if (state.alreadyEvaluated) BrandGold else BrandTextMuted,
            )
        }
        if (state.alreadyEvaluated) {
            Spacer(Modifier.height(6.dp))
            Text(
                "Thanks — your review of this story is in.",
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
            )
            return@Column
        }

        Spacer(Modifier.height(12.dp))
        val tick: (Int, (Int) -> Unit) -> Unit = { value, set ->
            haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove)
            set(value)
        }
        ReviewCard("Audio quality", "Is it clear and easy to listen to?", state.audioQuality) { tick(it, onAudioQuality) }
        Spacer(Modifier.height(10.dp))
        ReviewCard("Storytelling", "Did it hold your attention?", state.storytelling) { tick(it, onStorytelling) }
        Spacer(Modifier.height(10.dp))
        ReviewCard("Matches the description", "Is it what the title promised?", state.descriptionAccuracy) {
            tick(it, onDescriptionAccuracy)
        }

        Spacer(Modifier.height(16.dp))
        GoldButton(
            text = if (state.submitting) "Sending…" else "Submit review",
            onClick = {
                haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                onSubmit()
            },
            enabled = !state.submitting,
            height = 48.dp,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

private val SCORE_WORDS = listOf("", "Poor", "Fair", "Good", "Great", "Superb")

@Composable
private fun ReviewCard(title: String, question: String, score: Int, onChange: (Int) -> Unit) {
    val shape = RoundedCornerShape(BrandRadius.xxl)
    val glow by androidx.compose.animation.core.animateFloatAsState(
        targetValue = score / 5f,
        animationSpec = androidx.compose.animation.core.tween(350),
        label = "glow",
    )
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(
                androidx.compose.ui.graphics.Brush.horizontalGradient(
                    listOf(BrandGold.copy(alpha = 0.04f + 0.10f * glow), fans.echoes.client.ui.theme.BrandPanel),
                ),
            )
            .border(androidx.compose.foundation.BorderStroke(1.dp, BrandGold.copy(alpha = 0.15f + 0.45f * glow)), shape)
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = BrandText)
                Text(question, style = MaterialTheme.typography.bodySmall, color = BrandTextMuted)
            }
            androidx.compose.animation.AnimatedContent(
                targetState = score,
                transitionSpec = {
                    (androidx.compose.animation.slideInVertically { it } + androidx.compose.animation.fadeIn()) togetherWith
                        (androidx.compose.animation.slideOutVertically { -it } + androidx.compose.animation.fadeOut())
                },
                label = "word",
            ) { value ->
                Text(SCORE_WORDS.getOrElse(value) { "" }, style = MaterialTheme.typography.labelMedium, color = BrandGold)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            (1..5).forEach { value ->
                ScoreRecord(
                    value = value,
                    filled = value <= score,
                    onClick = { onChange(value) },
                )
            }
        }
    }
}

/** One score button, drawn as a small record that turns gold when chosen. */
@Composable
private fun ScoreRecord(value: Int, filled: Boolean, onClick: () -> Unit) {
    val scale by androidx.compose.animation.core.animateFloatAsState(
        targetValue = if (filled) 1f else 0.86f,
        animationSpec = androidx.compose.animation.core.spring(dampingRatio = 0.5f),
        label = "scale",
    )
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(46.dp)
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .clip(CircleShape)
            .clickable(onClick = onClick)
            .semantics { contentDescription = "Score $value of 5" },
    ) {
        androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
            val r = size.minDimension / 2
            drawCircle(if (filled) Color(0xFF0B0B0B) else Color(0xFF161616), r)
            repeat(4) { i ->
                drawCircle(
                    Color.White.copy(alpha = if (filled) 0.10f else 0.05f),
                    r * (0.55f + i * 0.11f),
                    style = androidx.compose.ui.graphics.drawscope.Stroke(1f),
                )
            }
            drawCircle(if (filled) BrandGold else Color(0xFF2A2A2A), r * 0.42f)
        }
        Text(
            value.toString(),
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
            color = if (filled) fans.echoes.client.ui.theme.BrandBackground else BrandTextMuted,
        )
    }
}

@Composable
private fun PlayerBar(
    story: Story,
    playing: Boolean,
    buffering: Boolean,
    positionMs: Long,
    durationMs: Long,
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(48.dp).clip(CircleShape).background(BrandGold),
                contentAlignment = Alignment.Center,
            ) {
                if (buffering) {
                    CircularProgressIndicator(
                        color = Color.Black,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(20.dp),
                    )
                } else {
                    IconButton(onClick = { PlaybackController.play(story) }) {
                        Icon(
                            if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            contentDescription = if (playing) "Pause" else "Play",
                            tint = Color.Black,
                        )
                    }
                }
            }
            Spacer(Modifier.size(12.dp))
            Text(
                "${formatSeconds(positionMs)} / ${formatSeconds(durationMs)}",
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
            )
        }

        Scrubber(
            fraction = if (durationMs > 0) positionMs.toFloat() / durationMs else 0f,
            onSeek = { fraction ->
                if (durationMs > 0) PlaybackController.seekTo((fraction * durationMs).toLong())
            },
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        )

    }
}

private fun formatSeconds(millis: Long): String {
    val total = (millis / 1000).coerceAtLeast(0)
    val minutes = total / 60
    val seconds = total % 60
    return "%d:%02d".format(minutes, seconds)
}

/** A thin gold progress line with a round head; tap or drag anywhere on it to seek. */
@Composable
private fun Scrubber(fraction: Float, onSeek: (Float) -> Unit, modifier: Modifier = Modifier) {
    var dragFraction by remember { androidx.compose.runtime.mutableStateOf<Float?>(null) }
    val shown = (dragFraction ?: fraction).coerceIn(0f, 1f)
    androidx.compose.foundation.Canvas(
        modifier
            .height(28.dp)
            .semantics { contentDescription = "Playback position ${(shown * 100).toInt()}%" }
            .pointerInput(Unit) {
                detectTapGestures { onSeek((it.x / size.width).coerceIn(0f, 1f)) }
            }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { dragFraction = (it.x / size.width).coerceIn(0f, 1f) },
                    onDragEnd = { dragFraction?.let(onSeek); dragFraction = null },
                    onDragCancel = { dragFraction = null },
                ) { change, _ ->
                    dragFraction = (change.position.x / size.width).coerceIn(0f, 1f)
                }
            },
    ) {
        val y = size.height / 2
        val track = 3.dp.toPx()
        drawLine(Color.White.copy(alpha = 0.12f), Offset(0f, y), Offset(size.width, y), track, StrokeCap.Round)
        drawLine(BrandGold, Offset(0f, y), Offset(size.width * shown, y), track, StrokeCap.Round)
        drawCircle(BrandGold, radius = if (dragFraction != null) 9.dp.toPx() else 7.dp.toPx(), center = Offset(size.width * shown, y))
    }
}

/** How much audio one full turn of the record covers when scrubbing. */
private const val MS_PER_TURN = 3000f
