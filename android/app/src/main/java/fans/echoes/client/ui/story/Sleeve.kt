package fans.echoes.client.ui.story

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import fans.echoes.client.data.api.Story
import fans.echoes.client.playback.PlaybackController
import fans.echoes.client.ui.theme.BrandBackground
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandGoldDark
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.data.cover.CoverArt
import fans.echoes.client.ui.theme.CoverImage
import fans.echoes.client.ui.theme.DefaultVinylLabel
import fans.echoes.client.ui.theme.VinylDisc
import fans.echoes.client.ui.theme.rememberReducedMotion
import fans.echoes.client.ui.theme.rememberTilt
import fans.echoes.client.ui.theme.rememberVinylSpin
import fans.echoes.client.ui.theme.sleeveGloss
import fans.echoes.client.ui.theme.spinnable

/**
 * A recording presented as a record in its sleeve. The sleeve catches the light
 * as the phone tilts. When the story plays, the record slides half out of the
 * sleeve to the right and spins; when it stops, the record stops too, and it
 * slides back in when another story takes over the player.
 */
@Composable
fun SleeveDeck(
    story: Story,
    active: Boolean,
    playing: Boolean,
    canPlay: Boolean,
    onToggle: () -> Unit,
    /** Degrees the record was turned by hand; negative is backwards. */
    onScrub: ((Float) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val spin = rememberVinylSpin()
    LaunchedEffect(playing) { spin.motorOn = playing }

    val out by animateFloatAsState(
        targetValue = if (active) 1f else 0f,
        animationSpec = spring(dampingRatio = 0.82f, stiffness = Spring.StiffnessLow),
        label = "slide",
    )

    BoxWithConstraints(modifier.fillMaxWidth().aspectRatio(1.3f)) {
        val w = maxWidth
        val h = maxHeight
        val sleeve = minOf(w * 0.7f, h * 0.94f)
        val disc = sleeve * 0.95f
        val top = (h - sleeve) / 2
        val sleeveX = (w - sleeve) / 2 * (1f - out)
        val discCx = lerp(w / 2, w - disc / 2, out)
        val noRipple = remember { MutableInteractionSource() }

        VinylDisc(
            spin = spin,
            modifier = Modifier
                .offset(x = discCx - disc / 2, y = (h - disc) / 2)
                .size(disc)
                // Like a real record: a hand holding it still pauses the story,
                // giving it a spin starts it again.
                .spinnable(
                    spin,
                    onHoldStill = if (playing) onToggle else null,
                    onFlick = if (!playing && canPlay) onToggle else null,
                    // Turning the record by hand moves through the story, like
                    // nudging a real one: backwards rewinds, forwards skips ahead.
                    onScrub = if (active) onScrub else null,
                )
                .semantics {
                    contentDescription = if (playing) "Record playing. Hold it still to pause." else "Record. Spin it to play."
                },
        ) {
            CoverImage(story.coverImageUrl, Modifier.fillMaxSize(), seed = CoverArt.seedOf(story.id), sizePx = 360)
            Box(Modifier.fillMaxSize().border(3.dp, BrandGoldDark, androidx.compose.foundation.shape.CircleShape))
        }

        Sleeve(
            story = story,
            size = sleeve,
            modifier = Modifier
                .offset(x = sleeveX, y = top)
                .clickable(
                    interactionSource = noRipple,
                    indication = null,
                    enabled = canPlay,
                    onClick = onToggle,
                )
                .semantics {
                    contentDescription = if (playing) "Pause ${story.title}" else "Play ${story.title}"
                },
        )
    }
}

private fun lerp(a: Dp, b: Dp, t: Float): Dp = a + (b - a) * t


@Composable
private fun Sleeve(story: Story, size: Dp, modifier: Modifier = Modifier) {
    val tilt by rememberTilt()
    val reduced = rememberReducedMotion()
    val ambient by if (reduced) {
        remember { androidx.compose.runtime.mutableFloatStateOf(0.5f) }
    } else {
        rememberInfiniteTransition(label = "gloss").animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(6500), RepeatMode.Reverse),
            label = "ambient",
        )
    }
    val shape = RoundedCornerShape(4.dp)

    Box(
        modifier
            .size(size)
            .graphicsLayer {
                rotationY = tilt.x * 5f
                rotationX = -tilt.y * 3f
                cameraDistance = 14f * density
            }
            .shadow(18.dp, shape, ambientColor = Color.Black, spotColor = Color.Black)
            .clip(shape)
            .background(Color(0xFF101010)),
    ) {
        // Every sleeve has art: the story's own picture, or one Echoes draws for it.
        CoverImage(story.coverImageUrl, Modifier.fillMaxSize(), seed = CoverArt.seedOf(story.id), sizePx = 720)
        // Printed band at the foot of the sleeve, the way records set their titles.
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0.45f to Color.Transparent,
                        1.0f to Color.Black.copy(alpha = 0.88f),
                    ),
                ),
        )

        // Top line: house mark and the STEREO box, like a pressing from the seventies.
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(10.dp),
        ) {
            Text(
                "echoes · ${story.category.lowercase()}",
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, letterSpacing = 0.6.sp),
                color = BrandText.copy(alpha = 0.85f),
                modifier = Modifier.weight(1f),
                maxLines = 1,
            )
            Box(
                Modifier
                    .border(BorderStroke(1.dp, BrandText.copy(alpha = 0.8f)), RoundedCornerShape(2.dp))
                    .padding(horizontal = 4.dp, vertical = 1.dp),
            ) {
                Text(
                    "STEREO",
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp, letterSpacing = 1.sp),
                    color = BrandText.copy(alpha = 0.85f),
                )
            }
        }

        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(12.dp)) {
            BasicText(
                text = story.title.trimEnd('.').uppercase() + ".",
                maxLines = 2,
                autoSize = TextAutoSize.StepBased(minFontSize = 16.sp, maxFontSize = 40.sp, stepSize = 2.sp),
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-1).sp,
                    lineHeight = 1.0.em(),
                    color = BrandText,
                ),
            )
            Spacer(Modifier.size(4.dp))
            Text(
                story.authorTwitter?.let { "@$it" }
                    ?: story.authorWallet?.let { "${it.take(4)}…${it.takeLast(4)}" }
                    ?: "",
                style = MaterialTheme.typography.labelSmall,
                color = BrandTextMuted,
                maxLines = 1,
            )
        }

        if (story.isPrivate) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .align(Alignment.Center)
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color.Black.copy(alpha = 0.75f))
                    .border(BorderStroke(1.dp, BrandGold), RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Icon(Icons.Filled.Lock, contentDescription = null, tint = BrandGold, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    story.priceSol?.let { "$it SOL" } ?: "Private",
                    style = MaterialTheme.typography.labelMedium,
                    color = BrandGold,
                )
            }
        }

        // Light and paper grain: a separate layer so tilting redraws only this.
        Box(
            Modifier
                .fillMaxSize()
                .sleeveGloss(tilt = { tilt }, ambient = { ambient })
                .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)), shape),
        )
    }
}


private fun Double.em() = androidx.compose.ui.unit.TextUnit(this.toFloat(), androidx.compose.ui.unit.TextUnitType.Em)
