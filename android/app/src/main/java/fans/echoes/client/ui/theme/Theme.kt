package fans.echoes.client.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import fans.echoes.client.R

/**
 * The design tokens of the Echoes web product, transcribed from the stylesheet
 * the live site serves so the app and the site read as one product.
 *
 *   --bg #0c0c0c   --bg-2 #111     --bg-3 #161616
 *   --surface-1 #141414  --surface-2 #1a1a1a  --surface-3 #0f0f0f
 *   --border #ffffff17   --border-hover #ffffff2e
 *   --text-1 #ededed     --text-2 #888        --text-3 #444
 *   --amber #c8a84b      --amber-dim #c8a84b1a
 */
val BrandBackground = Color(0xFF0C0C0C)
val BrandBackground2 = Color(0xFF111111)
val BrandBackground3 = Color(0xFF161616)
val BrandSurface = Color(0xFF141414)
val BrandSurface2 = Color(0xFF1A1A1A)
val BrandSurface3 = Color(0xFF0F0F0F)
val BrandBorder = Color(0x17FFFFFF)
val BrandBorderHover = Color(0x2EFFFFFF)
val BrandText = Color(0xFFEDEDED)
val BrandTextMuted = Color(0xFF888888)
// The site's --text-3 (#444) is too dark for small type on a phone in daylight
// (2:1 on the page colour). Captions use #767676 instead, which clears 4.5:1.
val BrandTextFaint = Color(0xFF767676)
/** The site's original --text-3, for hairlines and decoration only — never text. */
val BrandHairline = Color(0xFF444444)
val BrandGold = Color(0xFFC8A84B)
val BrandGoldDim = Color(0x1AC8A84B)
val BrandGoldLight = Color(0xFFF0D080)
val BrandGoldDark = Color(0xFFA07830)
val BrandError = Color(0xFFF87171)

/** Panels sit over the living backdrop, so they are slightly see-through. */
val BrandPanel = Color(0xE6141414)

/** Horizontal page margin shared by every screen. */
val ScreenPadding = 20.dp

/** The web's inset highlight on glass panels: `inset 0 1px #ffffff0a`. */
val BrandGlassHighlight = Color(0x0AFFFFFF)

/** Tailwind's radius scale as the site uses it. */
object BrandRadius {
    val sm = 4.dp
    val md = 6.dp
    val lg = 8.dp
    val xl = 12.dp
    val xxl = 16.dp
    val xxxl = 24.dp
    val pill = 999.dp
}

/** Space Grotesk, the site's display face, bundled under the SIL OFL. */
val SpaceGrotesk = FontFamily(
    Font(R.font.space_grotesk_regular, FontWeight.Normal),
    Font(R.font.space_grotesk_medium, FontWeight.Medium),
    Font(R.font.space_grotesk_semibold, FontWeight.SemiBold),
    Font(R.font.space_grotesk_bold, FontWeight.Bold),
)

private val EchoesColors = darkColorScheme(
    primary = BrandGold,
    onPrimary = BrandBackground,
    secondary = BrandGold,
    onSecondary = BrandBackground,
    background = BrandBackground,
    onBackground = BrandText,
    surface = BrandSurface,
    onSurface = BrandText,
    surfaceVariant = BrandSurface2,
    onSurfaceVariant = BrandTextMuted,
    outline = BrandBorder,
    outlineVariant = BrandBorder,
    error = BrandError,
    onError = BrandBackground,
)

private fun brandStyle(
    size: Int,
    weight: FontWeight,
    lineHeight: Int = (size * 1.35).toInt(),
    letterSpacing: Double = 0.0,
) = TextStyle(
    fontFamily = SpaceGrotesk,
    fontSize = size.sp,
    fontWeight = weight,
    lineHeight = lineHeight.sp,
    letterSpacing = letterSpacing.sp,
)

private val EchoesTypography = Typography(
    // "records library" — 1.5rem, bold, tight tracking, as on the site.
    headlineMedium = brandStyle(24, FontWeight.Bold, 30, -0.7),
    headlineSmall = brandStyle(20, FontWeight.Bold, 26, -0.4),
    titleMedium = brandStyle(16, FontWeight.SemiBold, 21),
    titleSmall = brandStyle(14, FontWeight.SemiBold, 19),
    bodyLarge = brandStyle(16, FontWeight.Normal, 24),
    bodyMedium = brandStyle(14, FontWeight.Normal, 21),
    bodySmall = brandStyle(12, FontWeight.Normal, 17),
    // The uppercase, wide-tracked labels under each heading.
    labelSmall = brandStyle(11, FontWeight.Medium, 15, 1.4),
    labelMedium = brandStyle(12, FontWeight.Medium, 16, 0.6),
)

@Composable
fun EchoesTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = EchoesColors, typography = EchoesTypography, content = content)
}
