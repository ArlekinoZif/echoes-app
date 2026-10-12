package fans.echoes.client.ui.record

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import fans.echoes.client.data.cover.CoverArt
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandChip
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandPanel
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.DefaultVinylLabel
import fans.echoes.client.ui.theme.GoldButton
import fans.echoes.client.ui.theme.Grain
import fans.echoes.client.ui.theme.SectionLabel
import fans.echoes.client.ui.theme.VinylDisc
import fans.echoes.client.ui.theme.brandFieldColors
import fans.echoes.client.ui.theme.rememberReducedMotion
import fans.echoes.client.ui.theme.rememberVinylSpin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

private enum class Face { Front, Back }

/**
 * The finished take as a record being pressed. Intro: a sleeve rises, the record
 * slides into it, and the sleeve turns over to its back, where the story's
 * details are written. "Cover" turns it to the front to choose the picture;
 * "Done" turns it back. Publishing sends the sleeve down off the screen.
 */
@Composable
internal fun PressingStage(
    state: RecordUiState,
    playIntro: Boolean,
    onIntroDone: () -> Unit,
    cover: CoverActions,
    onTitle: (String) -> Unit,
    onDescription: (String) -> Unit,
    onCategory: (String) -> Unit,
    onPublishMode: (PublishMode) -> Unit,
    onPublish: () -> Unit,
    onDiscard: () -> Unit,
    onDismissError: () -> Unit,
    onFlownAway: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val reduced = rememberReducedMotion()
    var face by remember { mutableStateOf(if (playIntro) Face.Front else Face.Back) }
    val flip by animateFloatAsState(
        targetValue = if (face == Face.Front) 0f else 180f,
        animationSpec = tween(if (reduced) 0 else 480, easing = FastOutSlowInEasing),
        label = "flip",
    )

    // Intro: 0 → 1 over the sleeve's arrival and the record sliding in.
    val intro = remember { Animatable(if (playIntro) 0f else 1f) }
    LaunchedEffect(playIntro) {
        if (!playIntro) return@LaunchedEffect
        intro.snapTo(0f)
        intro.animateTo(1f, tween(if (reduced) 0 else 720, easing = FastOutSlowInEasing))
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        face = Face.Back
        // Let the flip finish before the pressing scene counts as settled.
        kotlinx.coroutines.delay(if (reduced) 0 else 480)
        onIntroDone()
    }

    // Published: the sleeve drops off the bottom of the screen.
    val fly = remember { Animatable(0f) }
    val screenHeight = LocalConfiguration.current.screenHeightDp.dp
    LaunchedEffect(state.stage) {
        if (state.stage != RecordStage.Published) return@LaunchedEffect
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        if (face == Face.Front) face = Face.Back
        fly.animateTo(1f, tween(if (reduced) 0 else 700, easing = FastOutSlowInEasing))
        onFlownAway()
    }

    // Discard: after a confirmation, the sleeve with its record drops into a bin
    // that rises at the bottom of the screen, then the deck comes back.
    var confirmDiscard by remember { mutableStateOf(false) }
    val trash = remember { Animatable(0f) }
    var trashing by remember { mutableStateOf(false) }
    LaunchedEffect(trashing) {
        if (!trashing) return@LaunchedEffect
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        trash.animateTo(1f, tween(if (reduced) 0 else 900, easing = FastOutSlowInEasing))
        onDiscard()
    }

    val publishing = state.stage == RecordStage.Publishing || state.stage == RecordStage.Published
    val coverImage = rememberCover(state.coverPath, state.coverSeed)

    BoxWithConstraints(modifier.fillMaxWidth()) {
    val areaHeight = maxHeight
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .graphicsLayer {
                val tr = trash.value
                transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0.2f)
                translationY = fly.value * screenHeight.toPx() + tr * areaHeight.toPx() * 0.72f
                rotationZ = fly.value * 9f - tr * 14f
                val shrink = 1f - 0.86f * tr
                scaleX = shrink
                scaleY = shrink
                alpha = (1f - fly.value * 0.6f) * (1f - ((tr - 0.8f) / 0.2f).coerceIn(0f, 1f))
            },
    ) {
        Spacer(Modifier.height(16.dp))

        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val side = maxWidth
            val t = intro.value

            // The record waits where it is; the sleeve rises from below and closes
            // over it, bottom edge first, the way a record is slipped into its jacket.
            if (t < 1f) {
                val spin = rememberVinylSpin()
                LaunchedEffect(Unit) { spin.motorOn = false }
                VinylDisc(
                    spin,
                    Modifier
                        .size(side * 0.94f)
                        .offset(x = side * 0.03f, y = side * 0.03f)
                        .graphicsLayer {
                            val squeeze = 1f - 0.04f * t
                            scaleX = squeeze
                            scaleY = squeeze
                        },
                ) { DefaultVinylLabel(title = "echoes", subtitle = "SIDE A") }
            }

            // The sleeve: front (cover) and back (details), turned by [flip].
            Box(
                Modifier
                    .fillMaxWidth()
                    .animateContentSize()
                    .graphicsLayer {
                        // Starts below the bottom edge — out of the navigation bar — and
                        // rises over the record, the reverse of the drop into the bin.
                        translationY = (1f - intro.value) * areaHeight.toPx()
                        rotationY = flip
                        cameraDistance = 18f * density
                    },
            ) {
                if (flip <= 90f) {
                    SleeveFront(
                        title = state.title,
                        durationSeconds = state.durationSeconds,
                        cover = coverImage,
                    )
                } else {
                    Box(Modifier.graphicsLayer { rotationY = 180f }) {
                        SleeveBack(
                            state = state,
                            publishing = publishing,
                            cover = coverImage,
                            onTurnToCover = {
                                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                face = Face.Front
                            },
                            onTitle = onTitle,
                            onDescription = onDescription,
                            onCategory = onCategory,
                            onPublishMode = onPublishMode,
                            onPublish = onPublish,
                        )
                    }
                }
            }
        }

        // Under the front: where the picture comes from.
        if (face == Face.Front && !playIntro && intro.value >= 1f && !publishing) {
            Spacer(Modifier.height(16.dp))
            SectionLabel("Cover")
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                SourceButton(Icons.Filled.PhotoLibrary, "Gallery", cover.gallery, Modifier.weight(1f))
                SourceButton(Icons.Filled.PhotoCamera, "Camera", cover.camera, Modifier.weight(1f))
                SourceButton(Icons.AutoMirrored.Filled.InsertDriveFile, "Files", cover.files, Modifier.weight(1f))
                SourceButton(Icons.Filled.AutoAwesome, "Generate", cover.generate, Modifier.weight(1f))
            }
            Spacer(Modifier.height(6.dp))
            Text(
                if (state.coverPath == null) "No picture chosen: this cover is generated from your story."
                else "Your picture, cropped square like a record sleeve.",
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
            )
            Spacer(Modifier.height(14.dp))
            GoldButton(
                text = "Done",
                onClick = {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    face = Face.Back
                },
                height = 48.dp,
                modifier = Modifier.fillMaxWidth(),
                trailing = {
                    Spacer(Modifier.size(8.dp))
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = fans.echoes.client.ui.theme.BrandBackground,
                        modifier = Modifier.size(20.dp),
                    )
                },
            )
        }

        if (face == Face.Back && !publishing && trash.value == 0f) {
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                TextButton(onClick = { confirmDiscard = true }) {
                    Icon(Icons.Filled.DeleteOutline, contentDescription = null, tint = BrandError, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.size(6.dp))
                    Text("Discard recording", color = BrandError)
                }
            }
        }

        ErrorLine(state.error, onDismissError)
        Spacer(Modifier.height(32.dp))
    }

    // The bin, rising as the sleeve falls into it.
    if (trash.value > 0f) {
        val t = trash.value
        val rise = (t / 0.3f).coerceIn(0f, 1f)
        val gulp = if (t > 0.8f) 1f + 0.12f * kotlin.math.sin(((t - 0.8f) / 0.2f) * Math.PI).toFloat() else 1f
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp)
                .size(76.dp)
                .graphicsLayer {
                    translationY = (1f - rise) * 120.dp.toPx()
                    alpha = rise
                    scaleX = gulp
                    scaleY = gulp
                }
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(BrandError.copy(alpha = 0.16f))
                .border(BorderStroke(1.dp, BrandError.copy(alpha = 0.6f)), androidx.compose.foundation.shape.CircleShape),
        ) {
            Icon(Icons.Filled.DeleteOutline, contentDescription = "Discarding", tint = BrandError, modifier = Modifier.size(36.dp))
        }
    }
    }

    if (confirmDiscard) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            containerColor = fans.echoes.client.ui.theme.BrandSurface,
            title = { Text("Discard this recording?") },
            text = {
                Text(
                    "The recording and everything written on its sleeve are deleted from this phone. This cannot be undone.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandTextMuted,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmDiscard = false
                    trashing = true
                }) { Text("Discard", color = BrandError) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDiscard = false }) { Text("Keep it", color = BrandTextMuted) }
            },
        )
    }
}

/** The chosen picture, or the cover generated for this take (drawn off the main thread). */
@Composable
private fun rememberCover(path: String?, seed: Long): Any? {
    val generated by produceState<ImageBitmap?>(null, seed) {
        value = withContext(Dispatchers.Default) { CoverArt.generate(seed, 720).asImageBitmap() }
    }
    return path?.let { File(it) } ?: generated
}

@Composable
private fun CoverPicture(cover: Any?, modifier: Modifier = Modifier) {
    when (cover) {
        is ImageBitmap -> Image(cover, contentDescription = null, contentScale = ContentScale.Crop, modifier = modifier)
        null -> Box(modifier.background(Color(0xFF15130F)))
        else -> AsyncImage(model = cover, contentDescription = null, contentScale = ContentScale.Crop, modifier = modifier)
    }
}

/** The sleeve's front: the cover with the title printed across its foot. */
@Composable
private fun SleeveFront(title: String, durationSeconds: Int, cover: Any?) {
    val shape = RoundedCornerShape(4.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .shadow(18.dp, shape)
            .clip(shape),
    ) {
        CoverPicture(cover, Modifier.fillMaxSize())
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(0.5f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.85f)),
            ),
        )
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "echoes · ${formatClock(durationSeconds)}",
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                color = BrandText.copy(alpha = 0.85f),
                modifier = Modifier.weight(1f),
            )
            Box(
                Modifier
                    .border(BorderStroke(1.dp, BrandText.copy(alpha = 0.8f)), RoundedCornerShape(2.dp))
                    .padding(horizontal = 4.dp, vertical = 1.dp),
            ) {
                Text("STEREO", style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = BrandText)
            }
        }
        BasicText(
            text = (title.ifBlank { "Untitled" }).trimEnd('.').uppercase() + ".",
            maxLines = 2,
            autoSize = TextAutoSize.StepBased(minFontSize = 18.sp, maxFontSize = 44.sp, stepSize = 2.sp),
            style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.Bold,
                letterSpacing = (-1).sp,
                color = BrandText,
            ),
            modifier = Modifier.align(Alignment.BottomStart).padding(14.dp),
        )
        Box(Modifier.fillMaxSize().drawWithContent { drawContent(); drawRect(Grain.brush, alpha = 0.06f) })
    }
}

/** The sleeve's back: card stock with the story's details written on it. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SleeveBack(
    state: RecordUiState,
    publishing: Boolean,
    cover: Any?,
    onTurnToCover: () -> Unit,
    onTitle: (String) -> Unit,
    onDescription: (String) -> Unit,
    onCategory: (String) -> Unit,
    onPublishMode: (PublishMode) -> Unit,
    onPublish: () -> Unit,
) {
    val shape = RoundedCornerShape(4.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .shadow(18.dp, shape)
            .clip(shape)
            .background(Brush.verticalGradient(listOf(Color(0xFF1A1712), Color(0xFF12100C))))
            .drawWithContent { drawContent(); drawRect(Grain.brush, alpha = 0.05f) }
            .border(BorderStroke(1.dp, BrandBorder), shape)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                SectionLabel("Side B · the story", color = BrandGold)
                Text(
                    "Recorded ${formatClock(state.durationSeconds)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = BrandText,
                )
            }
            // The cover thumbnail turns the sleeve over.
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .clip(RoundedCornerShape(BrandRadius.md))
                    .clickable(enabled = !publishing, onClick = onTurnToCover)
                    .padding(4.dp),
            ) {
                CoverPicture(cover, Modifier.size(56.dp).clip(RoundedCornerShape(3.dp)))
                Spacer(Modifier.height(4.dp))
                Text("Cover", style = MaterialTheme.typography.labelSmall, color = BrandGold)
            }
        }

        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = state.title,
            onValueChange = onTitle,
            label = { Text("Title") },
            supportingText = { Text("${state.title.length}/80", color = BrandTextFaint) },
            singleLine = true,
            enabled = !publishing,
            shape = RoundedCornerShape(BrandRadius.xl),
            colors = brandFieldColors(),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(4.dp))
        OutlinedTextField(
            value = state.description,
            onValueChange = onDescription,
            label = { Text("What is this story about?") },
            supportingText = { Text("${state.description.length}/500", color = BrandTextFaint) },
            minLines = 3,
            enabled = !publishing,
            shape = RoundedCornerShape(BrandRadius.xl),
            colors = brandFieldColors(),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        SectionLabel("Category")
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            RecordUiState.CATEGORIES.forEach { category ->
                BrandChip(
                    text = category,
                    selected = category == state.category,
                    enabled = !publishing,
                    onClick = { onCategory(category) },
                )
            }
        }

        Spacer(Modifier.height(18.dp))
        PublishModeChooser(mode = state.publishMode, enabled = !publishing, onSelect = onPublishMode)

        Spacer(Modifier.height(16.dp))
        GoldButton(
            text = when {
                publishing && state.paying -> "Waiting for the wallet…"
                publishing -> "Pressing…"
                state.publishMode == PublishMode.PayNow -> "Pay and publish"
                else -> "Submit for review"
            },
            onClick = onPublish,
            enabled = state.canPublish && !publishing,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            if (state.paying) "Confirm the payment in your wallet…"
            else if (state.publishMode == PublishMode.PayNow)
                "Your wallet pays the listing fee; Echoes verifies it on-chain before the story goes live."
            else "Publishing is free through community review. Listeners evaluate the story before it is listed.",
            style = MaterialTheme.typography.bodySmall,
            color = BrandTextMuted,
        )
    }
}

@Composable
private fun SourceButton(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .clip(RoundedCornerShape(BrandRadius.xl))
            .background(BrandPanel)
            .border(BorderStroke(1.dp, BrandBorder), RoundedCornerShape(BrandRadius.xl))
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
    ) {
        Icon(icon, contentDescription = null, tint = BrandGold, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(4.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, color = BrandText)
    }
}

