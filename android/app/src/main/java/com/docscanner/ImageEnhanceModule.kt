package com.docscanner

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

class ImageEnhanceModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName() = "ImageEnhance"

  private fun matrixFor(mode: String): ColorMatrix {
    return when (mode) {
      "grayscale" -> ColorMatrix().apply { setSaturation(0f) }
      "bw" -> {
        // Grayscale, then strong contrast for a photocopier-like result.
        val gray = ColorMatrix().apply { setSaturation(0f) }
        val contrast = 2.2f
        val offset = (-0.5f * contrast + 0.5f) * 255f
        val hard = ColorMatrix(
          floatArrayOf(
            contrast, 0f, 0f, 0f, offset,
            0f, contrast, 0f, 0f, offset,
            0f, 0f, contrast, 0f, offset,
            0f, 0f, 0f, 1f, 0f,
          ),
        )
        gray.postConcat(hard)
        gray
      }
      else -> {
        // "enhance": moderate contrast + brightness lift, slight saturation.
        val contrast = 1.35f
        val offset = (-0.5f * contrast + 0.5f) * 255f + 12f
        val base = ColorMatrix(
          floatArrayOf(
            contrast, 0f, 0f, 0f, offset,
            0f, contrast, 0f, 0f, offset,
            0f, 0f, contrast, 0f, offset,
            0f, 0f, 0f, 1f, 0f,
          ),
        )
        val sat = ColorMatrix().apply { setSaturation(1.1f) }
        base.postConcat(sat)
        base
      }
    }
  }

  @ReactMethod
  fun enhance(srcPath: String, mode: String, destPath: String, promise: Promise) {
    executor.execute {
      try {
        val src = File(srcPath.removePrefix("file://"))
        if (!src.exists()) {
          promise.reject("ENOENT", "Image not found: $srcPath")
          return@execute
        }
        val bitmap = BitmapFactory.decodeFile(src.absolutePath)
          ?: run {
            promise.reject("EDECODE", "Could not decode image")
            return@execute
          }
        val out = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val paint = Paint().apply {
          colorFilter = ColorMatrixColorFilter(matrixFor(mode))
        }
        canvas.drawBitmap(bitmap, 0f, 0f, paint)
        bitmap.recycle()

        val dest = File(destPath.removePrefix("file://"))
        dest.parentFile?.mkdirs()
        FileOutputStream(dest).use { stream ->
          out.compress(Bitmap.CompressFormat.JPEG, 90, stream)
        }
        out.recycle()
        promise.resolve(dest.absolutePath)
      } catch (e: Exception) {
        promise.reject("EENHANCE", e.message, e)
      }
    }
  }
}
