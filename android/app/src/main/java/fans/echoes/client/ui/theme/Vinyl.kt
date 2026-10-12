package fans.echoes.client.ui.theme

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.provider.Settings
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.first
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.min
import kotlin.random.Random

/**
 * The vinyl vocabulary of the app: a record that can be spun by hand or by the
 * "motor", the sleeve a recording lives in, and the light that moves across the
 * sleeve as the phone is tilted. Everything is drawn with plain Canvas calls so
 * it renders the same on every Android version the app supports (API 26+).
 */

/** How fast a finger must throw the record for it to count as "start it again". */
private const val FLICK_DEG_PER_SEC = 150f

/** 33⅓ rpm in degrees per second. */
private const val MOTOR_DEG_PER_SEC = 200f

/** True when the person has turned animations off in the system settings. */
@Composable
fun rememberReducedMotion(): Boolean {
    val context = LocalContext.current
    return remember {
        runCatching {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
        }.getOrDefault(false)
    }
}

/**
 * Rotation of a record. The platter turns under a motor, keeps some momentum
 * when flicked, and follows the finger while held — a finger held still stops it,
 * exactly like a hand on a real record.
 */
@Stable
class VinylSpin {
    var angle by mutableFloatStateOf(0f)
        internal set
    internal var velocity by mutableFloatStateOf(0f)
    var motorOn by mutableStateOf(false)
    var held by mutableStateOf(false)
        internal set

    internal val active: Boolean
        get() = motorOn || held || abs(velocity) > 0.5f
}

@Composable
fun rememberVinylSpin(): VinylSpin {
    val spin = remember { VinylSpin() }
    val reduced = rememberReducedMotion()
    LaunchedEffect(spin) {
        var last = 0L
        while (true) {
            // Sleep until something moves, so an idle record costs no frames.
            snapshotFlow { spin.active }.first { it }
            last = 0L
            while (spin.active) {
                withFrameNanos { now ->
                    val dt = if (last == 0L) 0f else ((now - last) / 1e9f).coerceAtMost(0.05f)
                    last = now
                    if (!spin.held) {
                        val target = if (spin.motorOn) MOTOR_DEG_PER_SEC * (if (reduced) 0.4f else 1f) else 0f
                        // The motor spins up briskly; a free record coasts down slowly.
                        val rate = if (spin.motorOn) 2.4f else 0.9f
                        spin.velocity += (target - spin.velocity) * min(1f, dt * rate)
                        if (!spin.motorOn && abs(spin.velocity) < 0.5f) spin.velocity = 0f
                        spin.angle = (spin.angle + spin.velocity * dt) % 360f
                    }
                }
            }
        }
    }
    return spin
}

/**
 * Lets a finger turn the record. [onHoldStill] fires once when the record is held
 * still for [holdMillis] while its motor is running — the "stop the platter"
 * gesture. [onFlick] fires when a still record is thrown back into motion.
 * [onScrub] reports every turn of the finger in degrees (negative = backwards),
 * for rewinding and fast-forwarding by hand.
 *
 * The callbacks are read through state rather than used as gesture keys: a hold
 * that pauses playback changes them mid-gesture, and restarting the gesture
 * under the finger used to leave the record marked as held for good — after
 * which the motor could never spin it again.
 */
fun Modifier.spinnable(
    spin: VinylSpin,
    holdMillis: Long = 650,
    onHoldStill: (() -> Unit)? = null,
    onFlick: (() -> Unit)? = null,
    onScrub: ((Float) -> Unit)? = null,
): Modifier = composed {
    val hold by rememberUpdatedState(onHoldStill)
    val flick by rememberUpdatedState(onFlick)
    val scrub by rememberUpdatedState(onScrub)
    pointerInput(spin) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            val center = Offset(size.width / 2f, size.height / 2f)
            fun angleOf(p: Offset) = Math.toDegrees(atan2((p.y - center.y).toDouble(), (p.x - center.x).toDouble())).toFloat()

            val motorWasOn = spin.motorOn
            spin.held = true
            var lastAngle = angleOf(down.position)
            var lastTime = down.uptimeMillis
            var stillSince = down.uptimeMillis
            var fired = false
            var smoothed = 0f
            try {
                while (true) {
                    // Poll so a finger resting on the record is noticed without any movement.
                    val event = withTimeoutOrNull(50L) { awaitPointerEvent() }
                    val now = event?.changes?.firstOrNull()?.uptimeMillis ?: (lastTime + 50L).also { lastTime = it }
                    if (event != null) {
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        val a = angleOf(change.position)
                        var delta = a - lastAngle
                        if (delta > 180f) delta -= 360f
                        if (delta < -180f) delta += 360f
                        val dt = ((change.uptimeMillis - lastTime).coerceAtLeast(1)) / 1000f
                        spin.angle = (spin.angle + delta) % 360f
                        smoothed = smoothed * 0.6f + (delta / dt) * 0.4f
                        spin.velocity = smoothed
                        lastAngle = a
                        lastTime = change.uptimeMillis
                        if (change.positionChange().getDistance() > 2f) {
                            stillSince = change.uptimeMillis
                            if (delta != 0f) scrub?.invoke(delta)
                        }
                        change.consume()
                    } else {
                        smoothed *= 0.5f
                        spin.velocity = smoothed
                    }
                    val onHold = hold
                    if (!fired && motorWasOn && onHold != null && now - stillSince >= holdMillis) {
                        fired = true
                        spin.velocity = 0f
                        onHold()
                    }
                }
                // A flick keeps its momentum; a record let go after being held still stays still.
                if (lastTime - stillSince > 120) spin.velocity = 0f
            } finally {
                spin.held = false
            }
            val onFlick = flick
            if (onFlick != null && abs(spin.velocity) > FLICK_DEG_PER_SEC) onFlick()
        }
    }
}

/**
 * A 12" record seen from above. The grooves, dust and label turn with [spin];
 * the light reflections stay put, which is what makes a real record look like
 * it is spinning under a lamp.
 */
@Composable
fun VinylDisc(
    spin: VinylSpin,
    modifier: Modifier = Modifier,
    label: @Composable BoxScope.() -> Unit = { DefaultVinylLabel() },
) {
    Box(modifier, contentAlignment = Alignment.Center) {
        val seed = remember { Random(7) }
        val grooves = remember {
            List(70) { i -> Triple(0.38f + i * 0.0085f, 0.018f + seed.nextFloat() * 0.05f, i % 17 == 0) }
        }
        val specks = remember {
            List(22) { Triple(seed.nextFloat() * 360f, 0.4f + seed.nextFloat() * 0.55f, 4f + seed.nextFloat() * 22f) }
        }

        // Body and grooves (rotating).
        Canvas(Modifier.fillMaxSize().graphicsLayer { rotationZ = spin.angle }) {
            val r = size.minDimension / 2f
            val c = center
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(Color(0x66000000), Color.Transparent),
                    center = c + Offset(0f, r * 0.04f),
                    radius = r * 1.08f,
                ),
                radius = r * 1.08f,
                center = c + Offset(0f, r * 0.04f),
            )
            drawCircle(Color(0xFF0B0B0B), radius = r, center = c)
            drawCircle(Color(0xFF151515), radius = r, center = c, style = Stroke(r * 0.02f))
            grooves.forEach { (fr, alpha, gap) ->
                drawCircle(
                    color = if (gap) Color(0xFF050505) else Color.White.copy(alpha = alpha),
                    radius = r * fr,
                    center = c,
                    style = Stroke(width = if (gap) r * 0.012f else 1f),
                )
            }
            // Dust and hairline scratches — asymmetric, so a turning record reads as turning.
            specks.forEach { (deg, fr, len) ->
                rotate(deg, c) {
                    drawArc(
                        color = Color.White.copy(alpha = 0.07f),
                        startAngle = 0f,
                        sweepAngle = len,
                        useCenter = false,
                        topLeft = Offset(c.x - r * fr, c.y - r * fr),
                        size = androidx.compose.ui.geometry.Size(r * fr * 2, r * fr * 2),
                        style = Stroke(1.2f),
                    )
                }
            }
        }

        // Label (rotating).
        Box(
            Modifier
                .fillMaxSize(0.36f)
                .graphicsLayer { rotationZ = spin.angle }
                .clip(CircleShape),
            contentAlignment = Alignment.Center,
            content = label,
        )

        // Fixed light: two soft reflections and the spindle.
        Canvas(Modifier.fillMaxSize()) {
            val r = size.minDimension / 2f
            drawCircle(
                brush = Brush.sweepGradient(
                    0.00f to Color.Transparent,
                    0.10f to Color.White.copy(alpha = 0.10f),
                    0.18f to Color.Transparent,
                    0.50f to Color.Transparent,
                    0.60f to Color.White.copy(alpha = 0.07f),
                    0.68f to Color.Transparent,
                    1.00f to Color.Transparent,
                    center = center,
                ),
                radius = r * 0.985f,
            )
            drawCircle(BrandBackground, radius = r * 0.022f)
            drawCircle(BrandGoldDark, radius = r * 0.022f, style = Stroke(1.5f))
        }
    }
}

/** The house label: gold, with the name and side printed on it. */
@Composable
fun BoxScope.DefaultVinylLabel(title: String = "echoes", subtitle: String = "SIDE A · 33⅓") {
    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(listOf(BrandGoldLight, BrandGold, BrandGoldDark)),
            ),
    )
    androidx.compose.foundation.layout.Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.align(Alignment.Center),
    ) {
        androidx.compose.material3.Text(
            title,
            style = androidx.compose.material3.MaterialTheme.typography.titleSmall,
            color = BrandBackground,
            maxLines = 1,
        )
        androidx.compose.foundation.layout.Spacer(Modifier.size(14.dp))
        androidx.compose.material3.Text(
            subtitle,
            style = androidx.compose.material3.MaterialTheme.typography.labelSmall.copy(
                fontSize = androidx.compose.ui.unit.TextUnit(7f, androidx.compose.ui.unit.TextUnitType.Sp),
                lineHeight = androidx.compose.ui.unit.TextUnit(9f, androidx.compose.ui.unit.TextUnitType.Sp),
            ),
            color = BrandBackground.copy(alpha = 0.75f),
        )
    }
}

/** A ring of gold around an image label, as a picture disc would have. */
fun Modifier.labelRing(): Modifier = border(2.dp, BrandGoldDark, CircleShape)

/**
 * Film grain as a repeating tile. Generated once per process; the pattern is
 * random noise, so a small tile repeated is indistinguishable from a large one.
 */
object Grain {
    val bitmap: ImageBitmap by lazy {
        val side = 96
        val random = Random(42)
        val pixels = IntArray(side * side) {
            val v = random.nextInt(256)
            val a = random.nextInt(40, 110)
            (a shl 24) or (v shl 16) or (v shl 8) or v
        }
        android.graphics.Bitmap.createBitmap(pixels, side, side, android.graphics.Bitmap.Config.ARGB_8888)
            .asImageBitmap()
    }

    val brush: ShaderBrush by lazy {
        ShaderBrush(ImageShader(bitmap, TileMode.Repeated, TileMode.Repeated))
    }
}

/**
 * Device tilt in the range -1..1 on both axes, relative to how the phone is being
 * held. The accelerometer exists on every Android phone; the reading drifts back
 * to zero, so light moves when the phone moves rather than tracking an absolute pose.
 * Without a sensor (or with animations off) the value stays at zero.
 */
@Composable
fun rememberTilt(): State<Offset> {
    val context = LocalContext.current
    val reduced = rememberReducedMotion()
    val tilt = remember { mutableStateOf(Offset.Zero) }
    DisposableEffect(context, reduced) {
        val manager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        val sensor = manager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        if (manager == null || sensor == null || reduced) return@DisposableEffect onDispose { }
        var baseX = Float.NaN
        var baseY = Float.NaN
        var x = 0f
        var y = 0f
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                val ax = event.values[0] / SensorManager.GRAVITY_EARTH
                val ay = event.values[1] / SensorManager.GRAVITY_EARTH
                if (baseX.isNaN()) { baseX = ax; baseY = ay }
                baseX += (ax - baseX) * 0.015f
                baseY += (ay - baseY) * 0.015f
                // Gentle: a modest gain and heavy smoothing, so the light glides
                // across the sleeve instead of jumping with every hand tremor.
                x += ((-(ax - baseX) * 1.6f).coerceIn(-1f, 1f) - x) * 0.07f
                y += (((ay - baseY) * 1.6f).coerceIn(-1f, 1f) - y) * 0.07f
                tilt.value = Offset(x, y)
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }
        manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME)
        onDispose { manager.unregisterListener(listener) }
    }
    return tilt
}

/**
 * The glossy band that slides across a sleeve. [tilt] moves it; [ambient] (0..1,
 * time-driven) keeps a faint sweep alive on phones held perfectly still.
 */
fun Modifier.sleeveGloss(tilt: () -> Offset, ambient: () -> Float): Modifier =
    this.then(
        Modifier.drawWithGloss(tilt, ambient),
    )

private fun Modifier.drawWithGloss(tilt: () -> Offset, ambient: () -> Float): Modifier =
    this.drawWithContent {
        drawContent()
        val t = tilt()
        val sweep = (0.5f + t.x * 0.3f + t.y * 0.12f + (ambient() - 0.5f) * 0.12f)
        val w = size.width
        val h = size.height
        val cx = -w * 0.3f + sweep * w * 1.6f
        drawRect(
            brush = Brush.linearGradient(
                0.0f to Color.Transparent,
                0.32f to Color.White.copy(alpha = 0.0f),
                0.5f to Color.White.copy(alpha = 0.09f + (abs(t.x) + abs(t.y)) * 0.05f),
                0.68f to Color.White.copy(alpha = 0.0f),
                1.0f to Color.Transparent,
                start = Offset(cx - w * 0.6f, 0f),
                end = Offset(cx + w * 0.6f, h),
            ),
        )
        // Paper grain over everything, like printed card stock.
        drawRect(brush = Grain.brush, alpha = 0.06f)
    }

/** A small record peeking out of a thumbnail, used in lists. */
@Composable
fun MiniVinyl(size: Dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size)) {
        val r = this.size.minDimension / 2f
        drawCircle(Color(0xFF050505), r)
        drawCircle(Color.White.copy(alpha = 0.22f), r - 0.75f, style = Stroke(1.5f))
        repeat(8) { i -> drawCircle(Color.White.copy(alpha = 0.10f), r * (0.5f + i * 0.06f), style = Stroke(1f)) }
        drawCircle(BrandGold, r * 0.3f)
        drawCircle(BrandBackground, r * 0.05f)
    }
}
