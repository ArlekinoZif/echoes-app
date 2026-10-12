# kotlinx.serialization keeps its generated serializers via annotations.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class fans.echoes.client.** {
    *** Companion;
}
-keepclasseswithmembers class fans.echoes.client.** {
    kotlinx.serialization.KSerializer serializer(...);
}
