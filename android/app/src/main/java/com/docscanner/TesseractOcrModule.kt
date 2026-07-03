package com.docscanner

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.File
import java.util.concurrent.Executors

class TesseractOcrModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName() = "TesseractOcr"

  private fun ensureTessData(): File {
    val dataParent = File(reactApplicationContext.filesDir, "tesseract")
    val tessdata = File(dataParent, "tessdata")
    if (!tessdata.exists()) {
      tessdata.mkdirs()
    }
    val assets = reactApplicationContext.assets
    val files = assets.list("tessdata") ?: emptyArray()
    for (name in files) {
      val out = File(tessdata, name)
      if (!out.exists()) {
        assets.open("tessdata/$name").use { input ->
          out.outputStream().use { output -> input.copyTo(output) }
        }
      }
    }
    return dataParent
  }

  @ReactMethod
  fun recognize(imagePath: String, languages: String, promise: Promise) {
    executor.execute {
      var tess: TessBaseAPI? = null
      try {
        val dataParent = ensureTessData()
        val imageFile = File(imagePath.removePrefix("file://"))
        if (!imageFile.exists()) {
          promise.reject("ENOENT", "Image not found: $imagePath")
          return@execute
        }
        tess = TessBaseAPI()
        if (!tess.init(dataParent.absolutePath, languages)) {
          promise.reject("EINIT", "Could not initialize Tesseract for languages: $languages")
          return@execute
        }
        tess.setImage(imageFile)
        val text = tess.utF8Text ?: ""
        promise.resolve(text)
      } catch (e: Exception) {
        promise.reject("EOCR", e.message, e)
      } finally {
        tess?.recycle()
      }
    }
  }
}
