plugins {
    id("com.android.application") version "8.11.1" apply false
}

// Výstupy sestavení mimo OneDrive (synchronizace jinak zamyká soubory)
allprojects {
    val base = System.getenv("LOCALAPPDATA") ?: System.getProperty("java.io.tmpdir")
    layout.buildDirectory.set(file("$base/weilhub-android-build/${project.name}"))
}
