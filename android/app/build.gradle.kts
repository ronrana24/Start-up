plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.startup.rider"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.startup.rider"
        minSdk = 27
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"${providers.gradleProperty("API_BASE_URL").orElse("http://10.0.2.2:2424").get()}\"",
        )
        buildConfigField(
            "String",
            "GOOGLE_WEB_CLIENT_ID",
            "\"${providers.gradleProperty("GOOGLE_WEB_CLIENT_ID").orElse("").get()}\"",
        )
        buildConfigField(
            "String",
            "GOOGLE_MAPS_API_KEY",
            "\"${providers.gradleProperty("GOOGLE_MAPS_API_KEY").orElse("").get()}\"",
        )
        buildConfigField(
            "long",
            "LOCATION_INTERVAL_SECONDS",
            providers.gradleProperty("RIDER_LOCATION_INTERVAL_SECONDS").orElse("15").get(),
        )
        buildConfigField(
            "float",
            "LOCATION_MIN_DISTANCE_METERS",
            providers.gradleProperty("RIDER_LOCATION_MIN_DISTANCE_METERS").orElse("25").get() + "f",
        )
        manifestPlaceholders["googleMapsApiKey"] =
            providers.gradleProperty("GOOGLE_MAPS_API_KEY").orElse("").get()
        resValue(
            "string",
            "firebase_application_id",
            providers.gradleProperty("FIREBASE_APPLICATION_ID").orElse("").get(),
        )
        resValue(
            "string",
            "firebase_api_key",
            providers.gradleProperty("FIREBASE_API_KEY").orElse("").get(),
        )
        resValue(
            "string",
            "firebase_project_id",
            providers.gradleProperty("FIREBASE_PROJECT_ID").orElse("").get(),
        )
        resValue(
            "string",
            "firebase_sender_id",
            providers.gradleProperty("FIREBASE_SENDER_ID").orElse("").get(),
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        buildConfig = true
        resValues = true
    }
}

dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.material)
    implementation(libs.firebase.messaging)
    implementation(libs.gms.auth)
    implementation(libs.gms.auth.api.phone)
    implementation(libs.gms.location)
    implementation(libs.gms.maps)
    implementation(libs.okhttp.logging)
    implementation(libs.places)
    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)
    implementation(libs.security.crypto)
    implementation(libs.socket.io) {
        exclude(group = "org.json", module = "json")
    }
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
}
