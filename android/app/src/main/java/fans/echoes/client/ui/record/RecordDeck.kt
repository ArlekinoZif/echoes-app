package fans.echoes.client.ui.record

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import fans.echoes.client.ui.theme.BrandBackground
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandGoldDark
import fans.echoes.client.ui.theme.BrandGoldLight
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.DefaultVinylLabel
import fans.echoes.client.ui.theme.VinylDisc
import fans.echoes.client.ui.theme.rememberVinylSpin
import fans.echoes.client.ui.theme.spinnable
import kotlin.math.cos
import kotlin.math.sin

/**
 * The turntable. Idle: a still record you can spin by hand, and a Record button.
 * On record the button loses its label, halves, flies to the record and turns
 * 45° to become the tonearm; the platter spins up, the live waveform and the
 * controls rise from the bottom.
 *
 * Pause is a real pause of the take, not its end: the pause button, or holding
 * the record still, stops the platter and freezes the clock. Play, or throwing
 * the record back into motion, continues the same take. Finishing ([leaving])
 * lifts the arm off the record and away before the sleeve arrives.
 */
@Composable
internal fun RecordDeck(
    takeRunning: Boolean,
    paused: Boolean,
    leaving: Boolean,
    elapsedSeconds: Int,
    levels: List<Float>,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onFinish: () -> Unit,
    onDiscard: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val spin = rememberVinylSpin()
    LaunchedEffect(takeRunning, paused, leaving) { spin.motorOn = takeRunning && !paused && !leaving }
    val live = takeRunning && !leaving

    val p by animateFloatAsState(
        targetValue = if (takeRunning) 1f else 0f,
        animationSpec = spring(dampingRatio = 0.72f, stiffness = Spring.StiffnessMediumLow),
        label = "arm",
    )
    // Paused: the arm rises a little off the grooves. Leaving: it swings up and fades.
    val lift by animateFloatAsState(
        targetValue = when {
            leaving -> 1f
            paused -> 0.18f
            else -> 0f
        },
        animationSpec = tween(if (leaving) DECK_EXIT_MS.toInt() else 260),
        label = "lift",
    )

    BoxWithConstraints(modifier.fillMaxWidth()) {
        val w = maxWidth
        val h = maxHeight
        val bottomArea = 176.dp
        val disc = min(w * 0.88f, (h - bottomArea) * 0.9f)
        val discCx = w / 2
        val discCy = (h - bottomArea) / 2 + 8.dp

        VinylDisc(
            spin = spin,
            modifier = Modifier
                .offset(x = discCx - disc / 2, y = discCy - disc / 2)
                .size(disc)
                .spinnable(
                    spin,
                    onHoldStill = if (live && !paused) onPause else null,
                    onFlick = if (live && paused) onResume else null,
                )
                .semantics {
                    contentDescription = when {
                        paused -> "Record paused. Spin it to continue."
                        live -> "Record spinning. Hold it still to pause."
                        else -> "Record. Drag to spin."
                    }
                },
        ) {
            DefaultVinylLabel(
                title = "echoes",
                subtitle = when {
                    paused -> "PAUSED"
                    live -> "RECORDING"
                    else -> "SIDE A · 33⅓"
                },
            )
        }

        Text(
            when {
                leaving -> ""
                paused -> "Paused · spin the record or press play to continue"
                live -> "Hold the record still to pause"
                else -> "Give it a spin"
            },
            style = MaterialTheme.typography.labelSmall,
            color = BrandTextFaint,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .offset(y = discCy + disc / 2 + 10.dp),
        )

        // Waveform and controls rise in as the button turns into the arm.
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(bottomArea - 24.dp)
                .graphicsLayer {
                    alpha = p.coerceIn(0f, 1f) * (if (leaving) 1f - lift else 1f)
                    translationY = (1f - p) * 60.dp.toPx()
                },
        ) {
            LiveWaveform(levels, Modifier.fillMaxWidth().height(56.dp))
            Spacer(Modifier.height(14.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth(),
            ) {
                RoundControl(size = 48.dp, onClick = onDiscard, enabled = live, filled = false, description = "Discard this take") {
                    Icon(Icons.Filled.Close, contentDescription = null, tint = BrandTextMuted)
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        formatClock(elapsedSeconds),
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = if (paused) BrandTextMuted else BrandText,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(if (paused) BrandTextMuted else BrandError))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (paused) "PAUSED" else "REC · max ${formatClock(MAX_SECONDS)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = BrandTextFaint,
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    RoundControl(
                        size = 52.dp,
                        onClick = if (paused) onResume else onPause,
                        enabled = live,
                        filled = false,
                        description = if (paused) "Continue recording" else "Pause recording",
                    ) {
                        Icon(
                            if (paused) Icons.Filled.PlayArrow else Icons.Filled.Pause,
                            contentDescription = null,
                            tint = BrandGold,
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    RoundControl(size = 60.dp, onClick = onFinish, enabled = live, filled = true, description = "Finish this take") {
                        Icon(Icons.Filled.Check, contentDescription = null, tint = BrandBackground, modifier = Modifier.size(30.dp))
                    }
                }
            }
        }

        // The Record button, which becomes the tonearm.
        val buttonH = 56.dp
        val idleCx = w / 2
        val idleCy = h - buttonH / 2 - 4.dp

        // The needle lands on the outer grooves, upper right; the arm (half the
        // button's width) rises from there at 45° and must stay on screen.
        val armH = 18.dp
        val tipR = disc / 2 * 0.8f
        val tipAngle = Math.toRadians(58.0)
        val tipX = discCx + tipR * cos(tipAngle).toFloat()
        val tipY = discCy - tipR * sin(tipAngle).toFloat()
        val diag = 0.7071f
        val armLength = min(w * 0.5f, min((w - 6.dp - tipX) / diag, (tipY - 4.dp) / diag))
        val armCx = tipX + armLength / 2 * diag
        val armCy = tipY - armLength / 2 * diag

        val cx = lerp(idleCx, armCx, p)
        val cy = lerp(idleCy, armCy, p)
        val bw = lerp(w, armLength, p)
        val bh = lerp(buttonH, armH, p)

        // Two layers: the landing turn is about the arm's centre (that is how its
        // position was worked out); lifting swings it about the pivot end.
        Box(
            modifier = Modifier
                .offset(x = cx - bw / 2, y = cy - bh / 2)
                .size(bw, bh)
                .graphicsLayer {
                    rotationZ = -45f * p
                    alpha = if (leaving) 1f - lift else 1f
                },
        ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0.5f)
                    rotationZ = 40f * lift
                }
                .clip(RoundedCornerShape(BrandRadius.pill))
                .background(Brush.linearGradient(listOf(BrandGoldLight, BrandGold, BrandGoldDark)))
                .clickable(enabled = !takeRunning, onClick = onStart)
                .semantics { if (!takeRunning) contentDescription = "Start recording" },
        ) {
            val labelAlpha = (1f - p * 2.5f).coerceIn(0f, 1f)
            if (labelAlpha > 0f) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.graphicsLayer { alpha = labelAlpha },
                ) {
                    Icon(Icons.Filled.Mic, contentDescription = null, tint = BrandBackground, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Record",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = BrandBackground,
                    )
                }
            }
            // Headshell and needle at the left end, pivot at the right, fading in as it lands.
            val partsAlpha = ((p - 0.45f) / 0.55f).coerceIn(0f, 1f)
            if (partsAlpha > 0f) {
                Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = partsAlpha }) {
                    val hgt = size.height
                    drawRoundRect(
                        color = Color(0xFF2A2419),
                        topLeft = Offset(0f, 0f),
                        size = Size(hgt * 1.6f, hgt),
                        cornerRadius = CornerRadius(hgt / 2, hgt / 2),
                    )
                    drawCircle(BrandGoldLight, radius = hgt * 0.16f, center = Offset(hgt * 0.5f, hgt / 2))
                    drawCircle(Color(0xFF2A2419), radius = hgt * 0.42f, center = Offset(size.width - hgt / 2, hgt / 2))
                    drawCircle(BrandGold, radius = hgt * 0.2f, center = Offset(size.width - hgt / 2, hgt / 2))
                }
            }
        }
        }
    }
}

private fun lerp(a: Dp, b: Dp, t: Float): Dp = a + (b - a) * t
