package fans.echoes.client.data.auth

/**
 * Bitcoin-alphabet Base58, the encoding Solana uses for addresses. Written here
 * rather than pulled in as a dependency: it is a few lines and the app must agree
 * byte-for-byte with what the server expects.
 */
object Base58 {
    private const val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

    fun encode(input: ByteArray): String {
        if (input.isEmpty()) return ""

        val digits = IntArray(input.size * 2)
        var length = 0
        for (byte in input) {
            var carry = byte.toInt() and 0xFF
            var i = 0
            while (i < length || carry != 0) {
                if (i < length) carry += digits[i] shl 8
                digits[i] = carry % 58
                carry /= 58
                i++
            }
            length = i
        }

        val builder = StringBuilder()
        // Every leading zero byte is one leading '1'.
        for (byte in input) {
            if (byte.toInt() != 0) break
            builder.append(ALPHABET[0])
        }
        for (i in length - 1 downTo 0) builder.append(ALPHABET[digits[i]])
        return builder.toString()
    }

    fun decode(input: String): ByteArray {
        if (input.isEmpty()) return ByteArray(0)

        val bytes = IntArray(input.length * 2)
        var length = 0
        for (char in input) {
            var carry = ALPHABET.indexOf(char)
            require(carry >= 0) { "Invalid Base58 character '$char'" }
            var i = 0
            while (i < length || carry != 0) {
                if (i < length) carry += digits58(bytes, i)
                bytes[i] = carry % 256
                carry /= 256
                i++
            }
            length = i
        }

        var leadingZeros = 0
        for (char in input) {
            if (char != ALPHABET[0]) break
            leadingZeros++
        }

        val result = ByteArray(leadingZeros + length)
        for (i in 0 until length) result[leadingZeros + i] = bytes[length - 1 - i].toByte()
        return result
    }

    private fun digits58(bytes: IntArray, index: Int) = bytes[index] * 58
}
