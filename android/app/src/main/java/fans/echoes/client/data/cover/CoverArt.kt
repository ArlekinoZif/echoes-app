package fans.echoes.client.data.cover

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.SweepGradient
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * Cover art for a story. Either the person's own picture, scaled and compressed
 * for upload, or — when they choose none — a cover generated from the story
 * itself: the same title always yields the same cover, and no two stories look
 * alike. The generated art uses the app's vocabulary (a record's grooves, gold on
 * black, print halftone, film grain) so every story still looks like Echoes.
 */
object CoverArt {

    const val SIZE = 1080

    private data class Palette(val ink: Int, val paper: Int, val accent: Int, val glow: Int)

    private val palettes = listOf(
        Palette(ink = 0xFF0C0C0C.toInt(), paper = 0xFF16130D.toInt(), accent = 0xFFC8A84B.toInt(), glow = 0xFFF0D080.toInt()),
        Palette(ink = 0xFF0B0B0D.toInt(), paper = 0xFF1B1410.toInt(), accent = 0xFFD9824A.toInt(), glow = 0xFFF2B27A.toInt()),
        Palette(ink = 0xFF0A0C0C.toInt(), paper = 0xFF121716.toInt(), accent = 0xFFB9C7A8.toInt(), glow = 0xFFE9E3C9.toInt()),
        Palette(ink = 0xFF0D0A0A.toInt(), paper = 0xFF1C0F0F.toInt(), accent = 0xFFE0564A.toInt(), glow = 0xFFF3A08E.toInt()),
        Palette(ink = 0xFF0B0B0B.toInt(), paper = 0xFF171717.toInt(), accent = 0xFFEDEDED.toInt(), glow = 0xFFC8A84B.toInt()),
        Palette(ink = 0xFF080B12.toInt(), paper = 0xFF101828.toInt(), accent = 0xFF7FA7E0.toInt(), glow = 0xFFC9DBF5.toInt()),
        Palette(ink = 0xFF0B0A10.toInt(), paper = 0xFF1A1426.toInt(), accent = 0xFFB08BE0.toInt(), glow = 0xFFE3D2F7.toInt()),
        Palette(ink = 0xFF09100C.toInt(), paper = 0xFF12201A.toInt(), accent = 0xFF6FCF97.toInt(), glow = 0xFFC8F0D8.toInt()),
    )

    private enum class Style { Record, Bauhaus, Waves, Sun, Stripes }

    /** A stable seed from the story's words, so a cover survives an app restart. */
    fun seedOf(vararg parts: String): Long =
        parts.joinToString(" ").fold(1125899906842597L) { h, c -> 31 * h + c.code }

    /** Small covers for lists are drawn once per story and kept, not redrawn while scrolling. */
    private val cache = object : android.util.LruCache<String, Bitmap>(12 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    fun cached(seed: Long, size: Int): Bitmap {
        val key = "$seed/$size"
        return cache.get(key) ?: generate(seed, size).also { cache.put(key, it) }
    }

    fun generate(seed: Long, size: Int = SIZE): Bitmap {
        val rnd = Random(seed)
        val p = palettes[rnd.nextInt(palettes.size)]
        val style = Style.entries[rnd.nextInt(Style.entries.size)]
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val s = size.toFloat()
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // Paper: a dark diagonal wash, and a glow somewhere near the top.
        paint.shader = LinearGradient(0f, 0f, s, s, p.paper, p.ink, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, s, s, paint)
        val gx = s * (0.15f + rnd.nextFloat() * 0.7f)
        val gy = s * (0.1f + rnd.nextFloat() * 0.5f)
        paint.shader = RadialGradient(gx, gy, s * 0.7f, withAlpha(p.glow, 0x55), Color.TRANSPARENT, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, s, s, paint)
        paint.shader = null

        when (style) {
            Style.Record -> drawRecord(c, s, p, rnd, paint)
            Style.Bauhaus -> drawBauhaus(c, s, p, rnd, paint)
            Style.Waves -> drawWaves(c, s, p, rnd, paint)
            Style.Sun -> drawSun(c, s, p, rnd, paint)
            Style.Stripes -> drawStripes(c, s, p, rnd, paint)
        }

        // Film grain over everything, like printed card stock.
        val grain = Paint()
        repeat((size * size) / 90) {
            grain.color = withAlpha(if (rnd.nextBoolean()) Color.WHITE else Color.BLACK, 10 + rnd.nextInt(18))
            c.drawPoint(rnd.nextFloat() * s, rnd.nextFloat() * s, grain)
        }
        return bmp
    }

    /** A record partly off the sleeve, its grooves catching light, a soft band of print dots. */
    private fun drawRecord(c: Canvas, s: Float, p: Palette, rnd: Random, paint: Paint) {
        val cx = s * (0.3f + rnd.nextFloat() * 0.6f)
        val cy = s * (0.45f + rnd.nextFloat() * 0.6f)
        val radius = s * (0.55f + rnd.nextFloat() * 0.35f)
        paint.style = Paint.Style.FILL
        paint.color = withAlpha(0xFF050505.toInt(), 0xF0)
        c.drawCircle(cx, cy, radius, paint)
        paint.style = Paint.Style.STROKE
        var r = radius * 0.36f
        while (r < radius) {
            val band = rnd.nextFloat()
            paint.strokeWidth = if (band < 0.06f) s * 0.008f else s * 0.0013f
            paint.color = if (band < 0.06f) Color.BLACK else withAlpha(Color.WHITE, 10 + rnd.nextInt(22))
            c.drawCircle(cx, cy, r, paint)
            r += s * (0.004f + rnd.nextFloat() * 0.006f)
        }
        paint.style = Paint.Style.FILL
        val sweep = SweepGradient(
            cx, cy,
            intArrayOf(Color.TRANSPARENT, withAlpha(Color.WHITE, 0x30), Color.TRANSPARENT, Color.TRANSPARENT, withAlpha(p.glow, 0x28), Color.TRANSPARENT),
            floatArrayOf(0f, 0.08f, 0.18f, 0.5f, 0.6f, 0.72f),
        )
        sweep.setLocalMatrix(Matrix().apply { setRotate(rnd.nextFloat() * 360f, cx, cy) })
        paint.shader = sweep
        c.drawCircle(cx, cy, radius, paint)
        paint.shader = null
        paint.color = p.accent
        c.drawCircle(cx, cy, radius * 0.3f, paint)
        paint.color = p.ink
        c.drawCircle(cx, cy, radius * 0.025f, paint)
        halftoneBand(c, s, p, rnd, paint, cx, cy)
    }

    /** Overlapping discs, bars and a quarter circle, in the manner of a Bauhaus poster. */
    private fun drawBauhaus(c: Canvas, s: Float, p: Palette, rnd: Random, paint: Paint) {
        paint.style = Paint.Style.FILL
        val colors = listOf(p.accent, p.glow, withAlpha(Color.WHITE, 0xDD), p.ink)
        val cell = s / 3f
        for (i in 0 until 3) for (j in 0 until 3) {
            if (rnd.nextFloat() < 0.42f) continue
            paint.color = withAlpha(colors[rnd.nextInt(colors.size)], 150 + rnd.nextInt(90))
            val x = i * cell
            val y = j * cell
            when (rnd.nextInt(4)) {
                0 -> c.drawCircle(x + cell / 2, y + cell / 2, cell * 0.42f, paint)
                1 -> c.drawRect(x + cell * 0.1f, y + cell * 0.38f, x + cell * 0.9f, y + cell * 0.62f, paint)
                2 -> c.drawArc(x - cell * 0.5f, y - cell * 0.5f, x + cell * 1.5f, y + cell * 1.5f, 90f * rnd.nextInt(4), 90f, true, paint)
                else -> c.drawRect(x + cell * 0.38f, y + cell * 0.1f, x + cell * 0.62f, y + cell * 0.9f, paint)
            }
        }
    }

    /** Sound: stacked waveforms rippling out from one point, as if the story were drawn. */
    private fun drawWaves(c: Canvas, s: Float, p: Palette, rnd: Random, paint: Paint) {
        paint.style = Paint.Style.STROKE
        paint.strokeCap = Paint.Cap.ROUND
        val lines = 16 + rnd.nextInt(10)
        val amp = s * (0.05f + rnd.nextFloat() * 0.08f)
        val freq = 2f + rnd.nextFloat() * 4f
        val phase = rnd.nextFloat() * 6.28f
        for (l in 0 until lines) {
            val y0 = s * (0.15f + 0.7f * l / lines)
            val path = android.graphics.Path()
            var x = 0f
            while (x <= s) {
                val t = x / s
                val envelope = sin(t * Math.PI).toFloat()
                val y = y0 + amp * envelope * sin(t * freq * 6.28f + phase + l * 0.35f)
                if (x == 0f) path.moveTo(x, y) else path.lineTo(x, y)
                x += s / 120f
            }
            paint.strokeWidth = s * (if (l % 3 == 0) 0.006f else 0.002f)
            paint.color = withAlpha(if (l % 4 == 0) p.accent else p.glow, 70 + (120 * l / lines))
            c.drawPath(path, paint)
        }
    }

    /** A low sun behind a horizon of fine lines — a quiet, cinematic sleeve. */
    private fun drawSun(c: Canvas, s: Float, p: Palette, rnd: Random, paint: Paint) {
        paint.style = Paint.Style.FILL
        val cx = s * (0.3f + rnd.nextFloat() * 0.4f)
        val cy = s * (0.45f + rnd.nextFloat() * 0.15f)
        val r = s * (0.22f + rnd.nextFloat() * 0.12f)
        paint.shader = LinearGradient(cx, cy - r, cx, cy + r, p.glow, p.accent, Shader.TileMode.CLAMP)
        c.drawCircle(cx, cy, r, paint)
        paint.shader = null
        // Horizon lines cut the lower half of the sun, getting thicker towards the bottom.
        paint.color = p.ink
        var y = cy
        var gap = s * 0.012f
        while (y < cy + r) {
            c.drawRect(0f, y, s, y + gap * 0.55f, paint)
            y += gap
            gap *= 1.18f
        }
        paint.color = withAlpha(p.accent, 0x55)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = s * 0.0015f
        var hy = cy + r * 1.1f
        while (hy < s) {
            c.drawLine(0f, hy, s, hy, paint)
            hy += (hy - cy) * 0.12f + s * 0.01f
        }
    }

    /** Bold diagonal bands with a single outlined circle. */
    private fun drawStripes(c: Canvas, s: Float, p: Palette, rnd: Random, paint: Paint) {
        paint.style = Paint.Style.FILL
        val angle = if (rnd.nextBoolean()) 35f else -35f
        c.save()
        c.rotate(angle, s / 2, s / 2)
        val bands = 5 + rnd.nextInt(5)
        val w = s * 1.8f / bands
        for (i in 0 until bands) {
            if (rnd.nextFloat() < 0.35f) continue
            paint.color = withAlpha(if (i % 2 == 0) p.accent else p.glow, 60 + rnd.nextInt(130))
            val x = -s * 0.4f + i * w
            c.drawRect(x, -s, x + w * (0.3f + rnd.nextFloat() * 0.6f), s * 2, paint)
        }
        c.restore()
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = s * 0.012f
        paint.color = withAlpha(Color.WHITE, 0xCC)
        c.drawCircle(s * (0.25f + rnd.nextFloat() * 0.5f), s * (0.25f + rnd.nextFloat() * 0.5f), s * (0.12f + rnd.nextFloat() * 0.14f), paint)
    }

    private fun halftoneBand(c: Canvas, s: Float, p: Palette, rnd: Random, paint: Paint, cx: Float, cy: Float) {
        paint.style = Paint.Style.FILL
        val angle = Math.toRadians((rnd.nextInt(8) * 22.5)).toFloat()
        val step = s / (30 + rnd.nextInt(14))
        val bandCenter = rnd.nextFloat()
        paint.color = p.accent
        var y = -s
        while (y < s * 2) {
            var x = -s
            while (x < s * 2) {
                val px = cx + (x - cx) * cos(angle) - (y - cy) * sin(angle)
                val py = cy + (x - cx) * sin(angle) + (y - cy) * cos(angle)
                if (px in 0f..s && py in 0f..s) {
                    val t = 1f - kotlin.math.abs(py / s - bandCenter) * 3.2f
                    val dot = step * 0.36f * t.coerceIn(0f, 1f)
                    if (dot > 1f) {
                        paint.alpha = 95
                        c.drawCircle(px, py, dot, paint)
                    }
                }
                x += step
            }
            y += step
        }
        paint.alpha = 255
    }

    /** JPEG bytes ready for upload. */
    fun toJpeg(bitmap: Bitmap, quality: Int = 86): ByteArray =
        ByteArrayOutputStream().use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
            out.toByteArray()
        }

    /**
     * Loads a picture the person picked, upright and no larger than [SIZE] on its
     * short side, centre-cropped to a square like a record sleeve.
     */
    fun loadSquare(context: Context, uri: Uri): Bitmap? = runCatching {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        val shortSide = min(bounds.outWidth, bounds.outHeight)
        if (shortSide <= 0) return null
        var sample = 1
        while (shortSide / (sample * 2) >= SIZE) sample *= 2
        val decoded = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return null

        val rotation = resolver.openInputStream(uri)?.use {
            when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f
        square(decoded, rotation)
    }.getOrNull()

    /** Centre-crops and scales any bitmap (for example a camera preview) to the sleeve square. */
    fun square(source: Bitmap, rotation: Float = 0f): Bitmap {
        val side = min(source.width, source.height)
        val x = (source.width - side) / 2
        val y = (source.height - side) / 2
        val scale = min(1f, SIZE.toFloat() / side)
        val matrix = Matrix().apply {
            postScale(scale, scale)
            if (rotation != 0f) postRotate(rotation)
        }
        return Bitmap.createBitmap(source, x, y, side, side, matrix, true)
    }

    private fun withAlpha(color: Int, alpha: Int) = (color and 0x00FFFFFF) or (alpha.coerceIn(0, 255) shl 24)
}
