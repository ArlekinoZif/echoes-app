package fans.echoes.client.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import fans.echoes.client.data.SeekerDevice
import fans.echoes.client.data.api.DeviceDto
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandGoldDim
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.BrandSurface
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.GlassCard
import fans.echoes.client.ui.theme.GoldButton
import fans.echoes.client.ui.theme.SectionLabel
import java.time.Duration
import java.time.Instant

/**
 * Where this account is signed in. Every sign-in from the app is listed with the
 * phone's name; the owner can sign any other phone out from here, and it loses
 * access on its next request.
 */
@Composable
internal fun DevicesCard(state: ProfileUiState, onRemove: (String) -> Unit, onSignOutHere: () -> Unit) {
    var confirm by remember { mutableStateOf<DeviceDto?>(null) }
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        SectionLabel("Signed-in devices")
        Spacer(Modifier.height(6.dp))
        when {
            !state.devicesAvailable -> Text(
                "The device list switches on after the next server update.",
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
            )
            state.devices.isEmpty() -> Text(
                "This phone signed in before device tracking existed. Sign out and back in to list it here.",
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
            )
            else -> state.devices.forEachIndexed { i, device ->
                if (i > 0) HorizontalDivider(color = BrandBorder, thickness = 1.dp)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 10.dp)) {
                    Icon(Icons.Filled.PhoneAndroid, contentDescription = null, tint = if (device.current) BrandGold else BrandTextMuted)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(device.name, style = MaterialTheme.typography.titleSmall, color = BrandText, maxLines = 1)
                            if (device.seeker) {
                                Spacer(Modifier.width(6.dp))
                                Badge("Seeker")
                            }
                        }
                        Text(
                            listOfNotNull(
                                if (device.current) "This phone" else lastSeen(device.lastSeenAt),
                                device.platform,
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = BrandTextMuted,
                        )
                    }
                    if (state.removingDevice == device.id) {
                        CircularProgressIndicator(color = BrandGold, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    } else {
                        TextButton(onClick = { confirm = device }) {
                            Text(if (device.current) "Sign out" else "Remove", color = BrandError)
                        }
                    }
                }
            }
        }
    }

    confirm?.let { device ->
        AlertDialog(
            onDismissRequest = { confirm = null },
            containerColor = BrandSurface,
            title = { Text(if (device.current) "Sign out of this phone?" else "Remove ${device.name}?") },
            text = {
                Text(
                    if (device.current) "You can sign back in with your wallet at any time."
                    else "That phone is signed out on its next request and has to sign in with the wallet again.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandTextMuted,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirm = null
                    if (device.current) onSignOutHere() else onRemove(device.id)
                }) { Text(if (device.current) "Sign out" else "Remove", color = BrandError) }
            },
            dismissButton = { TextButton(onClick = { confirm = null }) { Text("Cancel", color = BrandTextMuted) } },
        )
    }
}

/**
 * Seeker ownership, proven the way Solana Mobile documents it: the signed-in
 * wallet (Sign In With Solana) holds a Seeker Genesis Token, checked on-chain by
 * the server. Shown on a Seeker, or wherever the account is already verified.
 */
@Composable
internal fun SeekerCard(state: ProfileUiState, onVerify: () -> Unit) {
    if (!SeekerDevice.isSeeker && !state.seekerVerified) return
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Verified, contentDescription = null, tint = if (state.seekerVerified) BrandGold else BrandTextMuted)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    if (state.seekerVerified) "Verified Seeker owner" else "Verify your Seeker",
                    style = MaterialTheme.typography.titleSmall,
                    color = BrandText,
                )
                Text(
                    if (state.seekerVerified) "Your Seeker Genesis Token is confirmed on-chain."
                    else "Checks your Seed Vault wallet for the Seeker Genesis Token. Nothing is signed or paid.",
                    style = MaterialTheme.typography.bodySmall,
                    color = BrandTextMuted,
                )
            }
        }
        state.seekerMessage?.takeIf { !state.seekerVerified }?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, style = MaterialTheme.typography.bodySmall, color = BrandError)
        }
        if (!state.seekerVerified) {
            Spacer(Modifier.height(12.dp))
            GoldButton(
                text = when {
                    state.seekerChecking -> "Checking…"
                    !state.seekerAvailable -> "Available after the next server update"
                    else -> "Verify my Seeker"
                },
                onClick = onVerify,
                enabled = state.seekerAvailable && !state.seekerChecking,
                height = 46.dp,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
internal fun Badge(text: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(BrandRadius.pill))
            .background(BrandGoldDim)
            .border(BorderStroke(1.dp, BrandGold.copy(alpha = 0.5f)), RoundedCornerShape(BrandRadius.pill))
            .padding(horizontal = 7.dp, vertical = 1.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = BrandGold)
    }
}

private fun lastSeen(iso: String): String {
    val then = runCatching { java.time.OffsetDateTime.parse(iso).toInstant() }.getOrNull() ?: return "Active"
    val d = Duration.between(then, Instant.now())
    return when {
        d.toMinutes() < 2 -> "Active now"
        d.toHours() < 1 -> "${d.toMinutes()} min ago"
        d.toDays() < 1 -> "${d.toHours()} h ago"
        else -> "${d.toDays()} d ago"
    }
}
