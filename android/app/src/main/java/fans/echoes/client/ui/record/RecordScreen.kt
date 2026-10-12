package fans.echoes.client.ui.record

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import fans.echoes.client.data.cover.CoverArt
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandBorderHover
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandGoldDim
import fans.echoes.client.ui.theme.BrandPanel
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.HoloText
import fans.echoes.client.ui.theme.ScreenPadding
import fans.echoes.client.ui.theme.SectionLabel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Recording, start to finish, as a pressing plant:
 *
 * 1. The deck ([RecordDeck]): the Record button becomes the tonearm, the platter
 *    spins, the take can be paused (button, or by holding the record still) and
 *    resumed (button, or by throwing the record back into motion).
 * 2. Finishing lifts the arm away; a sleeve arrives, the record slides into it
 *    and the sleeve turns over so the story's details are written on its back
 *    ([PressingStage]). Turning it to the front picks the cover.
 * 3. Publishing sends the sleeve down off the screen and the deck returns, ready
 *    for the next story.
 */
@Composable
fun RecordScreen(
    ownerId: String,
    walletSender: ActivityResultSender?,
    onPublished: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: RecordViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val levels by viewModel.levels.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    val micPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> if (granted) viewModel.start() }

    fun startWithPermission() {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) viewModel.start() else micPermission.launch(Manifest.permission.RECORD_AUDIO)
    }

    // ── Cover sources ─────────────────────────────────────────────────────────
    fun acceptUri(uri: Uri?) {
        uri ?: return
        scope.launch {
            val bitmap = withContext(Dispatchers.IO) { CoverArt.loadSquare(context, uri) }
            if (bitmap != null) viewModel.setCover(bitmap)
        }
    }
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { acceptUri(it) }
    val pickFile = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { acceptUri(it) }
    var cameraTarget by remember { mutableStateOf<Uri?>(null) }
    val takePhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        if (saved) acceptUri(cameraTarget)
    }
    val coverActions = CoverActions(
        gallery = { pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
        files = { runCatching { pickFile.launch("image/*") } },
        camera = {
            runCatching {
                val dir = File(context.cacheDir, "covers").apply { mkdirs() }
                val file = File(dir, "camera-${System.currentTimeMillis()}.jpg")
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.covers", file)
                cameraTarget = uri
                takePhoto.launch(uri)
            }
        },
        generate = viewModel::useGeneratedCover,
    )

    // ── Which scene is on screen ───────────────────────────────────────────────
    // After a take ends the deck stays briefly so the arm can lift away; then the
    // pressing scene plays its intro. A take restored after a restart skips both.
    val stage = state.stage
    var pressedBanner by remember { mutableStateOf(false) }
    var confirmDeckDiscard by remember { mutableStateOf(false) }
    LaunchedEffect(stage) {
        if (stage == RecordStage.Recording || stage == RecordStage.Paused) {
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        }
    }
    // A take just ended: let the arm lift away, then hand over to the sleeve.
    LaunchedEffect(state.finishing) {
        if (!state.finishing) return@LaunchedEffect
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        delay(DECK_EXIT_MS)
        viewModel.armLifted()
    }
    LaunchedEffect(pressedBanner) {
        if (pressedBanner) {
            delay(4000)
            pressedBanner = false
        }
    }

    val deckLeaving = state.finishing
    val onDeck = stage == RecordStage.Idle || state.isTakeRunning || deckLeaving

    Column(modifier = modifier.fillMaxSize().padding(horizontal = ScreenPadding)) {
        Spacer(Modifier.height(20.dp))
        HoloText(if (onDeck) "record a story" else "press your record")
        SectionLabel(
            when {
                onDeck -> "Up to 10 minutes · pause any time"
                else -> "Write it on the sleeve · pick a cover"
            },
        )

        AnimatedVisibility(
            visible = pressedBanner && stage == RecordStage.Idle,
            enter = fadeIn() + slideInVertically(),
            exit = fadeOut() + slideOutVertically(),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(BrandRadius.xl))
                    .background(BrandGoldDim)
                    .border(BorderStroke(1.dp, BrandGold.copy(alpha = 0.5f)), RoundedCornerShape(BrandRadius.xl))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) {
                Text(
                    "Pressed. Your story is in community review.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandGold,
                )
            }
        }

        // The deck fades and grows back in when a pressed or discarded record
        // leaves; going the other way the sleeve's own entrance does the work.
        val deckEnter = remember { androidx.compose.animation.core.Animatable(1f) }
        var wasOnDeck by remember { mutableStateOf(onDeck) }
        LaunchedEffect(onDeck) {
            if (onDeck && !wasOnDeck) {
                deckEnter.snapTo(0f)
                deckEnter.animateTo(1f, androidx.compose.animation.core.tween(420))
            }
            wasOnDeck = onDeck
        }
        val deckScene = onDeck
        Box(Modifier.weight(1f)) {
        if (deckScene) {
            Column(
                Modifier.fillMaxSize().graphicsLayer {
                    alpha = deckEnter.value
                    val grow = 0.9f + 0.1f * deckEnter.value
                    scaleX = grow
                    scaleY = grow
                },
            ) {
            RecordDeck(
                takeRunning = state.isTakeRunning || deckLeaving,
                paused = stage == RecordStage.Paused,
                leaving = deckLeaving,
                elapsedSeconds = state.elapsedSeconds,
                levels = levels,
                onStart = ::startWithPermission,
                onPause = {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    viewModel.pause()
                },
                onResume = {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    viewModel.resume()
                },
                onFinish = viewModel::stop,
                onDiscard = { confirmDeckDiscard = true },
                modifier = Modifier.weight(1f),
            )
            ErrorLine(state.error, viewModel::dismissError)
            }
        } else {
            PressingStage(
                state = state,
                playIntro = state.introPending,
                onIntroDone = viewModel::introShown,
                cover = coverActions,
                onTitle = viewModel::setTitle,
                onDescription = viewModel::setDescription,
                onCategory = viewModel::setCategory,
                onPublishMode = viewModel::setPublishMode,
                onPublish = { viewModel.publish(ownerId, walletSender) },
                onDiscard = viewModel::discard,
                onDismissError = viewModel::dismissError,
                onFlownAway = {
                    viewModel.finishPublished()
                    pressedBanner = true
                    onPublished()
                },
                modifier = Modifier.fillMaxSize(),
            )
        }
        }
    }

    if (confirmDeckDiscard) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmDeckDiscard = false },
            containerColor = fans.echoes.client.ui.theme.BrandSurface,
            title = { Text("Discard this take?") },
            text = {
                Text(
                    "What you have recorded so far is deleted. This cannot be undone.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandTextMuted,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmDeckDiscard = false
                    viewModel.discard()
                }) { Text("Discard", color = BrandError) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDeckDiscard = false }) { Text("Keep recording", color = BrandTextMuted) }
            },
        )
    }
}

/** How long the arm takes to lift away before the sleeve arrives. */
internal const val DECK_EXIT_MS = 520L

/** The four ways to put a picture on the sleeve. */
internal class CoverActions(
    val gallery: () -> Unit,
    val files: () -> Unit,
    val camera: () -> Unit,
    val generate: () -> Unit,
)

@Composable
internal fun ErrorLine(error: String?, onDismiss: () -> Unit) {
    error ?: return
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
    ) {
        Text(error, color = BrandError, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
        TextButton(onClick = onDismiss) { Text("Dismiss", color = BrandTextMuted) }
    }
}

@Composable
internal fun RoundControl(
    size: Dp,
    onClick: () -> Unit,
    enabled: Boolean,
    filled: Boolean,
    description: String,
    content: @Composable () -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(if (filled) BrandGold else BrandPanel)
            .border(BorderStroke(1.dp, if (filled) BrandGold else BrandBorderHover), CircleShape)
            .clickable(enabled = enabled, onClick = onClick)
            .semantics { contentDescription = description },
    ) { content() }
}

/** Mirrored bars of the last few seconds of loudness, newest on the right. */
@Composable
internal fun LiveWaveform(levels: List<Float>, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val n = levels.size
        if (n == 0) return@Canvas
        val slot = size.width / n
        val bar = slot * 0.55f
        val mid = size.height / 2
        levels.forEachIndexed { i, level ->
            val age = i.toFloat() / n
            val hgt = (0.06f + level * 0.94f) * size.height
            drawRoundRect(
                color = BrandGold.copy(alpha = 0.25f + 0.75f * age),
                topLeft = Offset(i * slot + (slot - bar) / 2, mid - hgt / 2),
                size = Size(bar, hgt),
                cornerRadius = CornerRadius(bar / 2, bar / 2),
            )
        }
    }
}

@Composable
internal fun PublishModeChooser(mode: PublishMode, enabled: Boolean, onSelect: (PublishMode) -> Unit) {
    Column {
        SectionLabel("How should it publish?")
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ModeOption(
                title = "Community review",
                subtitle = "Free",
                selected = mode == PublishMode.Review,
                enabled = enabled,
                onClick = { onSelect(PublishMode.Review) },
                modifier = Modifier.weight(1f),
            )
            ModeOption(
                title = "Publish now",
                subtitle = "2400 \$ECHOES",
                selected = mode == PublishMode.PayNow,
                enabled = enabled,
                onClick = { onSelect(PublishMode.PayNow) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun ModeOption(
    title: String,
    subtitle: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(BrandRadius.xl))
            .background(if (selected) BrandGoldDim else BrandPanel)
            .border(BorderStroke(1.dp, if (selected) BrandGold else BrandBorder), RoundedCornerShape(BrandRadius.xl))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleSmall, color = if (selected) BrandGold else BrandText)
        Spacer(Modifier.height(2.dp))
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = BrandTextMuted)
    }
}

internal fun formatClock(seconds: Int): String = "%d:%02d".format(seconds / 60, seconds % 60)
