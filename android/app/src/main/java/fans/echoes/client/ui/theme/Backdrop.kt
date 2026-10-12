package fans.echoes.client.ui.theme

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.withFrameMillis
import kotlinx.coroutines.delay
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Where the giant background record and the glows sit on each page, so moving
 * between tabs feels like moving around one room rather than reloading a wall.
 */
enum class Backdrop(
    val record: Offset,
    val glowA: Offset,
    val glowB: Offset,
) {
    Library(record = Offset(1.05f, 1.02f), glowA = Offset(0.1f, 0.05f), glowB = Offset(0.95f, 0.55f)),
    Record(record = Offset(0.5f, 0.42f), glowA = Offset(0.5f, 0.1f), glowB = Offset(0.1f, 0.9f)),
    Vote(record = Offset(-0.08f, 0.95f), glowA = Offset(0.9f, 0.08f), glowB = Offset(0.2f, 0.6f)),
    Zone(record = Offset(1.02f, 0.05f), glowA = Offset(0.05f, 0.35f), glowB = Offset(0.85f, 0.95f)),
    Story(record = Offset(-0.1f, 0.1f), glowA = Offset(0.85f, 0.2f), glowB = Offset(0.2f, 1.0f)),
}

/**
 * The app's living background: the dark page of the website, a warm gold glow and
 * a cool one drifting slowly, a huge record in the corner whose reflection turns,
 * and a film grain that flickers like a projector. Kept faint on purpose — it sits
 * behind text and must never compete with it.
 */
@Composable
fun EchoesBackdrop(backdrop: Backdrop, modifier: Modifier = Modifier) {
    val reduced = rememberReducedMotion()
    // The motion is slow, so ~20 redraws a second look the same as 60 and cost a
    // third of the GPU time — it matters on entry-level phones. The frame clock
    // stops while the app is in the background, so this costs nothing there.
    val time = remember { mutableFloatStateOf(0.25f) }
    if (!reduced) {
        LaunchedEffect(Unit) {
            val start = withFrameMillis { it }
            while (true) {
                val now = withFrameMillis { it }
                time.floatValue = ((now - start) % CYCLE_MS) / CYCLE_MS.toFloat()
                delay(48)
            }
        }
    }
    val grooves = remember { List(46) { i -> 0.28f + i * 0.0155f } }
    // Moving between pages slides the record and the glows rather than cutting.
    val motion = androidx.compose.animation.core.tween<Offset>(900)
    val record by androidx.compose.animation.core.animateOffsetAsState(backdrop.record, motion, label = "record")
    val glowA by androidx.compose.animation.core.animateOffsetAsState(backdrop.glowA, motion, label = "glowA")
    val glowB by androidx.compose.animation.core.animateOffsetAsState(backdrop.glowB, motion, label = "glowB")

    Canvas(modifier.fillMaxSize()) {
        val t = time.floatValue
        val phase = (t * 2 * PI).toFloat()
        drawRect(BrandBackground)

        glow(
            at = glowA.scaled(size.width, size.height) +
                Offset(cos(phase) * size.width * 0.08f, sin(phase) * size.height * 0.04f),
            radius = size.maxDimension * 0.62f,
            color = BrandGold.copy(alpha = 0.11f),
        )
        glow(
            at = glowB.scaled(size.width, size.height) +
                Offset(sin(phase) * size.width * 0.1f, cos(phase) * size.height * 0.05f),
            radius = size.maxDimension * 0.5f,
            color = Color(0xFF8FA3C8).copy(alpha = 0.05f),
        )

        // The giant record. Its grooves are static; only the reflection turns.
        val center = record.scaled(size.width, size.height)
        val radius = size.minDimension * 0.95f
        grooves.forEachIndexed { i, fr ->
            drawCircle(
                color = Color.White.copy(alpha = if (i % 9 == 0) 0.018f else 0.032f),
                radius = radius * fr,
                center = center,
                style = Stroke(width = if (i % 9 == 0) 3f else 1f),
            )
        }
        rotate(degrees = t * 360f, pivot = center) {
            drawCircle(
                brush = Brush.sweepGradient(
                    0.0f to Color.Transparent,
                    0.08f to BrandGold.copy(alpha = 0.06f),
                    0.16f to Color.Transparent,
                    0.55f to Color.Transparent,
                    0.62f to Color.White.copy(alpha = 0.035f),
                    0.70f to Color.Transparent,
                    1.0f to Color.Transparent,
                    center = center,
                ),
                radius = radius * 1.02f,
                center = center,
            )
        }

        // Grain, nudged a few pixels every ~80 ms so it shimmers instead of sitting still.
        val jitter = if (reduced) 0 else (t * 450f).toInt()
        translate(left = ((jitter * 37) % 96).toFloat() - 96f, top = ((jitter * 61) % 96).toFloat() - 96f) {
            drawRect(Grain.brush, topLeft = Offset.Zero, size = size.copy(size.width + 96f, size.height + 96f), alpha = 0.05f)
        }

        // Soft vignette keeps the edges dark so content reads first.
        drawRect(
            Brush.radialGradient(
                listOf(Color.Transparent, Color.Black.copy(alpha = 0.55f)),
                center = Offset(size.width / 2, size.height * 0.45f),
                radius = size.maxDimension * 0.85f,
            ),
        )
    }
}

private const val CYCLE_MS = 36_000L

private fun Offset.scaled(w: Float, h: Float) = Offset(x * w, y * h)

private fun DrawScope.glow(at: Offset, radius: Float, color: Color) {
    drawCircle(
        brush = Brush.radialGradient(listOf(color, Color.Transparent), center = at, radius = radius),
        radius = radius,
        center = at,
    )
}
