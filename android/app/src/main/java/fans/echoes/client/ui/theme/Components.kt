package fans.echoes.client.ui.theme

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The web product's visual primitives, rebuilt natively: the glass panel, the
 * shifting gold button and the holographic heading. Keeping them in one place is
 * what stops the app drifting away from the site.
 */

/** `.glass` — a #141414 panel with a hairline border and a highlight along its top edge. */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(BrandRadius.xxl),
    contentPadding: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .clip(shape)
            .background(BrandPanel)
            .border(BorderStroke(1.dp, BrandBorder), shape),
    ) {
        // inset 0 1px #ffffff0a
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(BrandGlassHighlight),
        )
        Column(Modifier.padding(contentPadding), content = content)
    }
}

/** The animated sweep used by `.btn-gold` and `.holo-text`. */
@Composable
private fun animatedShift(durationMillis: Int): Float {
    val transition = rememberInfiniteTransition(label = "shift")
    val value by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "offset",
    )
    return value
}

private val GoldStops = listOf(BrandGold, BrandGoldLight, BrandGold, BrandGoldDark, BrandGold)

/** `.btn-gold` — black label on a slowly shifting 135° gold gradient. */
@Composable
fun GoldButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    height: Dp = 50.dp,
    shape: Shape = RoundedCornerShape(BrandRadius.xl),
    leading: @Composable (RowScope.() -> Unit)? = null,
    trailing: @Composable (RowScope.() -> Unit)? = null,
) {
    val shift = animatedShift(5000)
    val width = 900f
    val brush = Brush.linearGradient(
        colors = GoldStops,
        start = Offset(-width + shift * width, 0f),
        end = Offset(shift * width, width),
    )

    Row(
        modifier = modifier
            .height(height)
            .clip(shape)
            .background(if (enabled) brush else Brush.linearGradient(listOf(BrandSurface2, BrandSurface2)))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke(this)
        Text(
            text,
            style = MaterialTheme.typography.titleMedium.copy(
                letterSpacing = 0.2.sp(),
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            ),
            color = if (enabled) BrandBackground else BrandTextFaint,
        )
        trailing?.invoke(this)
    }
}

private fun Double.sp() = androidx.compose.ui.unit.TextUnit(
    this.toFloat(),
    androidx.compose.ui.unit.TextUnitType.Sp,
)

/** `.holo-text` — the shifting light gradient the site uses for its page titles. */
@Composable
fun HoloText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.headlineMedium,
    textAlign: TextAlign? = null,
) {
    val shift = animatedShift(10000)
    val span = 700f
    Text(
        text = text,
        modifier = modifier,
        textAlign = textAlign,
        style = style.copy(
            brush = Brush.linearGradient(
                colors = listOf(BrandText, BrandTextMuted, BrandText, BrandGold, BrandText),
                start = Offset(-span + shift * span, 0f),
                end = Offset(shift * span, span),
            ),
        ),
    )
}

/** The uppercase, wide-tracked caption that sits under each page title. */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier, color: Color = BrandTextFaint) {
    Text(
        text.uppercase(),
        modifier = modifier,
        style = MaterialTheme.typography.labelSmall,
        color = color,
    )
}

/** A bordered, tinted chip — the site's category and filter pills. */
@Composable
fun BrandChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val shape = RoundedCornerShape(BrandRadius.pill)
    Box(
        modifier = modifier
            .clip(shape)
            .background(if (selected) BrandGoldDim else BrandSurface)
            .border(BorderStroke(1.dp, if (selected) BrandGold else BrandBorder), shape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text(
            text,
            style = MaterialTheme.typography.bodySmall,
            color = if (selected) BrandGold else BrandTextMuted,
        )
    }
}

/** Text fields in the site's style: a panel fill, hairline border, gold when focused. */
@Composable
fun brandFieldColors() = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
    focusedTextColor = BrandText,
    unfocusedTextColor = BrandText,
    disabledTextColor = BrandTextMuted,
    focusedContainerColor = BrandPanel,
    unfocusedContainerColor = BrandPanel,
    disabledContainerColor = BrandPanel,
    focusedBorderColor = BrandGold,
    unfocusedBorderColor = BrandBorderHover,
    disabledBorderColor = BrandBorder,
    focusedLabelColor = BrandGold,
    unfocusedLabelColor = BrandTextMuted,
    cursorColor = BrandGold,
    focusedPlaceholderColor = BrandTextFaint,
    unfocusedPlaceholderColor = BrandTextFaint,
)
