package fans.echoes.client.ui.theme

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import coil3.compose.SubcomposeAsyncImage
import coil3.compose.SubcomposeAsyncImageContent

/**
 * A story's cover everywhere it appears. Three states, each distinct:
 * no cover at all shows an empty record (nothing is wrong, there is just no art),
 * a cover still loading shows a quiet dark tile, and a cover that failed to load
 * shows a question mark so it does not pass for "no cover".
 */
@Composable
fun CoverImage(url: String?, modifier: Modifier = Modifier, seed: Long? = null, sizePx: Int = 256) {
    if (url.isNullOrBlank()) {
        if (seed != null) GeneratedCover(seed, sizePx, modifier) else EmptyRecordCover(modifier)
        return
    }
    SubcomposeAsyncImage(
        model = url,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier,
        loading = { Box(Modifier.fillMaxSize().background(BrandSurface2)) },
        error = { BrokenCover(Modifier.fillMaxSize()) },
        success = { SubcomposeAsyncImageContent() },
    )
}

/**
 * The art Echoes draws for a story that has no picture: the same generator that
 * makes covers for new recordings, seeded by the story so it never changes.
 * Drawn off the main thread and cached, so lists scroll smoothly.
 */
@Composable
fun GeneratedCover(seed: Long, sizePx: Int, modifier: Modifier = Modifier) {
    val bitmap by androidx.compose.runtime.produceState<androidx.compose.ui.graphics.ImageBitmap?>(null, seed, sizePx) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            fans.echoes.client.data.cover.CoverArt.cached(seed, sizePx).asImageBitmap()
        }
    }
    val image = bitmap
    if (image == null) {
        Box(modifier.background(BrandSurface2))
    } else {
        androidx.compose.foundation.Image(image, contentDescription = null, contentScale = ContentScale.Crop, modifier = modifier)
    }
}

/** An empty black record on a dark sleeve: the placeholder for a story without art. */
@Composable
fun EmptyRecordCover(modifier: Modifier = Modifier) {
    Canvas(modifier.background(Brush.linearGradient(listOf(Color(0xFF1A1712), BrandSurface3)))) {
        val r = size.minDimension * 0.36f
        drawCircle(Color(0xFF050505), r, center)
        repeat(6) { i -> drawCircle(Color.White.copy(alpha = 0.07f), r * (0.55f + i * 0.07f), center, style = Stroke(1f)) }
        drawCircle(BrandGold.copy(alpha = 0.85f), r * 0.3f, center)
        drawCircle(BrandSurface3, r * 0.05f, center)
    }
}

/** Shown when a cover exists but could not be loaded. */
@Composable
fun BrokenCover(modifier: Modifier = Modifier) {
    Box(
        modifier.background(BrandSurface2).semantics { contentDescription = "Cover could not be loaded" },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "?",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
            color = BrandTextMuted,
        )
    }
}
