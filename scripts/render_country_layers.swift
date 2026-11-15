import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct CountryManifestItem: Decodable {
    let id: String
    let nameEn: String
    let namePt: String
    let lon: Double
    let lat: Double
    let bbox: [Double] // [minLon, minLat, maxLon, maxLat] of primary geographic envelope
    let polygons: [[[[Double]]]] // [polygon][ring][[lon, lat]]
}

struct CountryManifest: Decodable {
    let workspaceDir: String
    let cacheDir: String
    let outBaseDir: String
    let countries: [CountryManifestItem]
}

let canvasSize = 1024
let marginRatio = 0.08

func saveCGImage(_ image: CGImage, to path: String) throws {
    let url = URL(fileURLWithPath: path)
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "RenderCountryLayers", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot create destination \(path)"])
    }
    CGImageDestinationAddImage(dest, image, nil)
    if !CGImageDestinationFinalize(dest) {
        throw NSError(domain: "RenderCountryLayers", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot finalize PNG \(path)"])
    }
}

struct EquirectField {
    let width: Int
    let height: Int
    let values: [Float] // continuous 0..1 intensity field

    func sampleBilinear(lon: Double, lat: Double) -> Float {
        var u = (lon + 180.0) / 360.0
        u = u - floor(u)
        let v = min(1.0, max(0.0, (90.0 - lat) / 180.0))

        let fx = u * Double(width - 1)
        let fy = v * Double(height - 1)

        let x0 = Int(floor(fx))
        let y0 = Int(floor(fy))
        let x1 = (x0 + 1) % width
        let y1 = min(height - 1, y0 + 1)

        let tx = Float(fx - Double(x0))
        let ty = Float(fy - Double(y0))

        let c00 = values[y0 * width + x0]
        let c10 = values[y0 * width + x1]
        let c01 = values[y1 * width + x0]
        let c11 = values[y1 * width + x1]

        let top = c00 * (1.0 - tx) + c10 * tx
        let bot = c01 * (1.0 - tx) + c11 * tx
        return top * (1.0 - ty) + bot * ty
    }
}

func loadRGBAImage(path: String) throws -> (width: Int, height: Int, rgba: [UInt8]) {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        throw NSError(domain: "RenderCountryLayers", code: 3, userInfo: [NSLocalizedDescriptionKey: "Missing image at \(path)"])
    }
    let w = cg.width
    let h = cg.height
    var buf = [UInt8](repeating: 0, count: w * h * 4)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: &buf,
        width: w,
        height: h,
        bitsPerComponent: 8,
        bytesPerRow: w * 4,
        space: cs,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        throw NSError(domain: "RenderCountryLayers", code: 4)
    }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
    return (w, h, buf)
}

func ensureCachedNasaFrames(workspace: String, cacheDir: String) throws {
    try FileManager.default.createDirectory(atPath: cacheDir, withIntermediateDirectories: true)
    let required = ["svs5011.png", "svs5147.png", "svs5148_comp.png", "svs5153.png", "svs5154.png"]
    let allExist = required.allSatisfy { FileManager.default.fileExists(atPath: "\(cacheDir)/\($0)") }
    if allExist { return }

    let w = 2048
    let h = 1024
    let cs = CGColorSpaceCreateDeviceRGB()

    func extractSingle(_ relVideo: String, _ outName: String, _ frac: Double) throws {
        let outPath = "\(cacheDir)/\(outName)"
        if FileManager.default.fileExists(atPath: outPath) { return }
        let asset = AVURLAsset(url: URL(fileURLWithPath: "\(workspace)/\(relVideo)"))
        let dur = CMTimeGetSeconds(asset.duration)
        let gen = AVAssetImageGenerator(asset: asset)
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: w, height: h)
        gen.requestedTimeToleranceBefore = CMTime(seconds: 0.5, preferredTimescale: 600)
        gen.requestedTimeToleranceAfter = CMTime(seconds: 0.5, preferredTimescale: 600)
        let cg = try gen.copyCGImage(at: CMTime(seconds: max(0.1, dur * frac), preferredTimescale: 600), actualTime: nil)
        try saveCGImage(cg, to: outPath)
    }

    // Composite 12 seasonal frames of SVS 5011 Lightning
    let lPath = "\(cacheDir)/svs5011.png"
    if !FileManager.default.fileExists(atPath: lPath) {
        let asset = AVURLAsset(url: URL(fileURLWithPath: "\(workspace)/public/nasa/svs5011_lightning_sos_4096x2048.mp4"))
        let dur = CMTimeGetSeconds(asset.duration)
        let gen = AVAssetImageGenerator(asset: asset)
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: w, height: h)
        gen.requestedTimeToleranceBefore = CMTime(seconds: 1.0, preferredTimescale: 600)
        gen.requestedTimeToleranceAfter = CMTime(seconds: 1.0, preferredTimescale: 600)
        var maxBuf = [UInt8](repeating: 0, count: w * h * 4)
        for idx in 0..<12 {
            let frac = (Double(idx) + 0.5) / 12.0
            if let cg = try? gen.copyCGImage(at: CMTime(seconds: dur * frac, preferredTimescale: 600), actualTime: nil) {
                var fBuf = [UInt8](repeating: 0, count: w * h * 4)
                if let ctx = CGContext(data: &fBuf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) {
                    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
                    for p in stride(from: 0, to: w * h * 4, by: 4) {
                        let sNew = Int(fBuf[p]) + Int(fBuf[p + 1]) - Int(fBuf[p + 2])
                        let sOld = Int(maxBuf[p]) + Int(maxBuf[p + 1]) - Int(maxBuf[p + 2])
                        if sNew > sOld || maxBuf[p + 3] == 0 {
                            maxBuf[p] = fBuf[p]; maxBuf[p + 1] = fBuf[p + 1]; maxBuf[p + 2] = fBuf[p + 2]; maxBuf[p + 3] = 255
                        }
                    }
                }
            }
        }
        if let outCtx = CGContext(data: &maxBuf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
           let img = outCtx.makeImage() {
            try saveCGImage(img, to: lPath)
        }
    }

    // Composite 10 timestamps of SVS 5148 Winds to capture multi-day continental wind streaks
    let wPath = "\(cacheDir)/svs5148_comp.png"
    if !FileManager.default.fileExists(atPath: wPath) {
        let asset = AVURLAsset(url: URL(fileURLWithPath: "\(workspace)/public/nasa/svs5148_wind_2048x1024.mp4"))
        let dur = CMTimeGetSeconds(asset.duration)
        let gen = AVAssetImageGenerator(asset: asset)
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: w, height: h)
        gen.requestedTimeToleranceBefore = CMTime(seconds: 0.8, preferredTimescale: 600)
        gen.requestedTimeToleranceAfter = CMTime(seconds: 0.8, preferredTimescale: 600)
        var maxBuf = [UInt8](repeating: 0, count: w * h * 4)
        var bestScore = [Float](repeating: -1.0, count: w * h)
        for idx in 0..<10 {
            let frac = (Double(idx) + 0.5) / 10.0
            if let cg = try? gen.copyCGImage(at: CMTime(seconds: dur * frac, preferredTimescale: 600), actualTime: nil) {
                var fBuf = [UInt8](repeating: 0, count: w * h * 4)
                if let ctx = CGContext(data: &fBuf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) {
                    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
                    for i in 0..<(w * h) {
                        let p = i * 4
                        let r = Float(fBuf[p]) / 255.0
                        let g = Float(fBuf[p + 1]) / 255.0
                        let b = Float(fBuf[p + 2]) / 255.0
                        let maxC = max(r, max(g, b))
                        let minC = min(r, min(g, b))
                        let chroma = maxC - minC
                        // Ignore baked dark grey country border strokes (chroma < 0.05 && maxC < 0.45)
                        let score: Float = (chroma < 0.05 && maxC < 0.45) ? 0.0 : (chroma * 1.4 + (1.0 - minC) * 0.25)
                        if score > bestScore[i] {
                            bestScore[i] = score
                            maxBuf[p] = fBuf[p]; maxBuf[p + 1] = fBuf[p + 1]; maxBuf[p + 2] = fBuf[p + 2]; maxBuf[p + 3] = 255
                        }
                    }
                }
            }
        }
        if let outCtx = CGContext(data: &maxBuf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
           let img = outCtx.makeImage() {
            try saveCGImage(img, to: wPath)
        }
    }

    try extractSingle("public/nasa/svs5147_temp_2048x1024.mp4", "svs5147.png", 0.35)
    try extractSingle("public/nasa/svs5153_co_2048x1024.mp4", "svs5153.png", 0.35)
    try extractSingle("public/nasa/svs5154_nox_2048x1024.mp4", "svs5154.png", 0.35)
}

func buildDecodedField(rgba: [UInt8], width: Int, height: Int, kind: String) -> EquirectField {
    var raw = [Float](repeating: 0, count: width * height)
    var borderMask = [Bool](repeating: false, count: width * height)

    for i in 0..<(width * height) {
        let p = i * 4
        let rn = Float(rgba[p]) / 255.0
        let gn = Float(rgba[p + 1]) / 255.0
        let bn = Float(rgba[p + 2]) / 255.0
        let lum = 0.299 * rn + 0.587 * gn + 0.114 * bn
        let maxC = max(rn, max(gn, bn))
        let minC = min(rn, min(gn, bn))
        let chroma = maxC - minC

        switch kind {
        case "melody": // SVS 5011 ISS Lightning (yellow flashes over dark grey Earth)
            let yellow = max(0, (rn * 0.55 + gn * 0.45) - bn * 1.15)
            if chroma < 0.08 {
                raw[i] = 0.0 // ignore grey coastlines and equator/tropic dashed lines
            } else {
                raw[i] = min(1.0, max(0.0, (yellow - 0.06) / 0.68))
            }

        case "chords": // SVS 5153 Carbon Monoxide CO (cream-yellow 40 -> orange 100 -> bright red 160 -> dark maroon 500)
            if maxC < 0.26 && chroma < 0.07 {
                borderMask[i] = true
            }
            // Differentiate cream-yellow (0.05) -> orange (0.35) -> bright red (0.68) -> deep dark maroon (1.0)
            let dropGB = min(1.0, max(0.0, 1.0 - gn * 0.72 - bn * 0.38))
            let maroonBoost: Float = (rn > gn * 2.0 && gn < 0.22) ? max(0.0, 0.92 - rn) * 0.55 : 0.0
            raw[i] = min(1.0, max(0.0, (dropGB * 0.76 + maroonBoost - 0.10) / 0.86))

        case "temperature": // SVS 5147 2m Temperature (thermal intensity + extreme plateau contrast)
            // Warmth: dark crimson / red / grey-hot domes vs mild yellow/green vs cold blue/violet
            if bn > rn + 0.10 {
                // Sub-zero / cold highland contrast (e.g. Tibetan Plateau / Andes)
                let cold = min(1.0, (bn - rn) * 1.15)
                raw[i] = 0.22 + 0.62 * cold
            } else if chroma < 0.08 && lum > 0.35 && lum < 0.78 {
                // Extreme +36..+42C grey-white heat dome core inside dark crimson (e.g. Brazil Cerrado / Sahara)
                raw[i] = 0.96
            } else {
                // Continuous warmth from mild yellow (rn~0.9, gn~0.85 -> ~0.25) to deep red/maroon (rn>0.35, gn<0.2 -> ~0.92)
                let heat = max(0.0, rn * 0.65 + (1.0 - gn) * 0.58 - bn * 0.35)
                raw[i] = min(0.95, max(0.08, (heat - 0.18) / 0.72))
            }

        case "bass": // SVS 5154 NO2 (white/pale mint low -> vivid green mid -> deep dark forest green high)
            // Baked 1px coastline borders are neutral black (rn ≈ gn ≈ bn < 0.14), whereas high NO2 has gn > rn + 0.05
            if maxC < 0.22 && (gn - max(rn, bn)) < 0.04 {
                borderMask[i] = true
            }
            let nox = 1.0 - lum
            raw[i] = min(1.0, max(0.0, (nox - 0.10) / 0.72))

        case "wind": // SVS 5148 10m Winds (white/grey calm land -> indigo/blue/cyan/yellow/red wind streaks)
            if chroma < 0.06 && lum < 0.52 {
                borderMask[i] = true // dark grey baked country border on white land
            }
            if chroma < 0.06 && lum >= 0.52 {
                raw[i] = 0.04 // calm continental air
            } else {
                let speedScore = chroma * 1.35 + max(0.0, 0.85 - lum) * 0.35
                raw[i] = min(1.0, max(0.05, (speedScore - 0.05) / 0.78))
            }

        default:
            raw[i] = 0
        }
    }

    // 3x3 de-bordering pass for baked GMAO coastline strokes
    var cleaned = raw
    if kind == "chords" || kind == "bass" || kind == "wind" {
        for y in 2..<(height - 2) {
            for x in 2..<(width - 2) {
                let idx = y * width + x
                if borderMask[idx] {
                    var sum: Float = 0
                    var cnt: Float = 0
                    for dy in -2...2 {
                        for dx in -2...2 {
                            let nIdx = (y + dy) * width + (x + dx)
                            if !borderMask[nIdx] {
                                sum += raw[nIdx]
                                cnt += 1
                            }
                        }
                    }
                    if cnt > 0 { cleaned[idx] = sum / cnt }
                }
            }
        }
    }

    return EquirectField(width: width, height: height, values: cleaned)
}

/// Mask-normalized separable Gaussian blur in 1024x1024 canvas space:
/// Eliminates coarse equirectangular grid blocks on small/medium countries while keeping silhouette edges clean.
func smoothCanvasField(_ input: [Float], mask: [UInt8], size: Int, sigma: Float) -> [Float] {
    let radius = max(1, min(28, Int(ceil(sigma * 2.6))))
    var kernel = [Float](repeating: 0, count: radius * 2 + 1)
    let twoSigmaSq = 2.0 * sigma * sigma
    for k in -radius...radius {
        kernel[k + radius] = exp(-Float(k * k) / twoSigmaSq)
    }

    var horizVal = [Float](repeating: 0, count: size * size)
    var horizW = [Float](repeating: 0, count: size * size)

    for y in 0..<size {
        let row = y * size
        for x in 0..<size {
            if mask[row + x] == 0 { continue }
            var acc: Float = 0
            var wSum: Float = 0
            let xMin = max(0, x - radius)
            let xMax = min(size - 1, x + radius)
            for nx in xMin...xMax {
                let m = Float(mask[row + nx]) / 255.0
                if m <= 0 { continue }
                let kw = kernel[nx - x + radius] * m
                acc += input[row + nx] * kw
                wSum += kw
            }
            if wSum > 0 {
                horizVal[row + x] = acc / wSum
                horizW[row + x] = 1.0
            }
        }
    }

    var out = [Float](repeating: 0, count: size * size)
    for y in 0..<size {
        for x in 0..<size {
            let idx = y * size + x
            if mask[idx] == 0 { continue }
            var acc: Float = 0
            var wSum: Float = 0
            let yMin = max(0, y - radius)
            let yMax = min(size - 1, y + radius)
            for ny in yMin...yMax {
                let nIdx = ny * size + x
                if horizW[nIdx] <= 0 { continue }
                let kw = kernel[ny - y + radius]
                acc += horizVal[nIdx] * kw
                wSum += kw
            }
            if wSum > 0 {
                out[idx] = acc / wSum
            }
        }
    }
    return out
}

func photoshopAlpha(value01: Float, layer: String) -> UInt8 {
    let v = min(1.0, max(0.0, value01))
    // Shay's Photoshop stained-glass curve:
    // Weak/basal data stays translucent (alpha 6..24), moderate sits 45..130, only intense cores reach ~235
    let alphaFloat: Float
    if layer == "melody" {
        if v < 0.05 {
            alphaFloat = 5.0 + (v / 0.05) * 10.0
        } else {
            let t = min(1.0, (v - 0.05) / 0.55)
            let curved = pow(t, 0.82)
            alphaFloat = 18.0 + curved * (235.0 - 18.0)
        }
    } else {
        let curved = pow(v, 1.95)
        alphaFloat = 8.0 + curved * (235.0 - 8.0)
    }
    return UInt8(min(235, max(0, Int(alphaFloat.rounded()))))
}

struct LayerSpec {
    let id: String
    let r: UInt8
    let g: UInt8
    let b: UInt8
}

let layerSpecs: [LayerSpec] = [
    LayerSpec(id: "melody", r: 251, g: 191, b: 36),       // #fbbf24
    LayerSpec(id: "chords", r: 251, g: 146, b: 60),       // #fb923c
    LayerSpec(id: "temperature", r: 251, g: 113, b: 133), // #fb7185
    LayerSpec(id: "bass", r: 52, g: 211, b: 153),         // #34d399
    LayerSpec(id: "wind", r: 56, g: 189, b: 248)          // #38bdf8
]

// --- Entrypoint ---
guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: render_country_layers <manifest.json>\n", stderr)
    exit(1)
}

let manifestData = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let manifest = try JSONDecoder().decode(CountryManifest.self, from: manifestData)

try ensureCachedNasaFrames(workspace: manifest.workspaceDir, cacheDir: manifest.cacheDir)

let img5011 = try loadRGBAImage(path: "\(manifest.cacheDir)/svs5011.png")
let img5153 = try loadRGBAImage(path: "\(manifest.cacheDir)/svs5153.png")
let img5147 = try loadRGBAImage(path: "\(manifest.cacheDir)/svs5147.png")
let img5154 = try loadRGBAImage(path: "\(manifest.cacheDir)/svs5154.png")
let img5148 = try loadRGBAImage(path: "\(manifest.cacheDir)/svs5148_comp.png")

let fields: [String: EquirectField] = [
    "melody": buildDecodedField(rgba: img5011.rgba, width: img5011.width, height: img5011.height, kind: "melody"),
    "chords": buildDecodedField(rgba: img5153.rgba, width: img5153.width, height: img5153.height, kind: "chords"),
    "temperature": buildDecodedField(rgba: img5147.rgba, width: img5147.width, height: img5147.height, kind: "temperature"),
    "bass": buildDecodedField(rgba: img5154.rgba, width: img5154.width, height: img5154.height, kind: "bass"),
    "wind": buildDecodedField(rgba: img5148.rgba, width: img5148.width, height: img5148.height, kind: "wind")
]

let graySpace = CGColorSpaceCreateDeviceGray()
let rgbSpace = CGColorSpaceCreateDeviceRGB()

for country in manifest.countries {
    let minLon = country.bbox[0]
    let minLat = country.bbox[1]
    let maxLon = country.bbox[2]
    let maxLat = country.bbox[3]

    let midLatRad = ((minLat + maxLat) * 0.5) * .pi / 180.0
    let cosLat = max(0.18, cos(midLatRad))
    let geoW = max(0.05, (maxLon - minLon) * cosLat)
    let geoH = max(0.05, maxLat - minLat)

    let usable = Double(canvasSize) * (1.0 - 2.0 * marginRatio) // 860.16 px (8% padding on dominant side)
    let scale = usable / max(geoW, geoH)
    let drawnW = geoW * scale
    let drawnH = geoH * scale
    let offsetX = (Double(canvasSize) - drawnW) * 0.5
    let offsetY = (Double(canvasSize) - drawnH) * 0.5

    func geoToImg(_ lon: Double, _ lat: Double) -> (Double, Double) {
        let ix = offsetX + (lon - minLon) * cosLat * scale
        let iy = offsetY + (maxLat - lat) * scale
        return (ix, iy)
    }

    func imgToGeo(_ ix: Double, _ iy: Double) -> (Double, Double) {
        let lon = minLon + (ix - offsetX) / (cosLat * scale)
        let lat = maxLat - (iy - offsetY) / scale
        return (lon, lat)
    }

    // Build CGPath in CoreGraphics coordinates (cgX = ix, cgY = canvasSize - iy)
    let path = CGMutablePath()
    for poly in country.polygons {
        for ring in poly {
            guard let first = ring.first else { continue }
            let (fx, fy) = geoToImg(first[0], first[1])
            path.move(to: CGPoint(x: fx, y: Double(canvasSize) - fy))
            for pt in ring.dropFirst() {
                let (px, py) = geoToImg(pt[0], pt[1])
                path.addLine(to: CGPoint(x: px, y: Double(canvasSize) - py))
            }
            path.closeSubpath()
        }
    }

    var fillMask = [UInt8](repeating: 0, count: canvasSize * canvasSize)
    var strokeMask = [UInt8](repeating: 0, count: canvasSize * canvasSize)

    if let fillCtx = CGContext(data: &fillMask, width: canvasSize, height: canvasSize, bitsPerComponent: 8, bytesPerRow: canvasSize, space: graySpace, bitmapInfo: CGImageAlphaInfo.none.rawValue) {
        fillCtx.setShouldAntialias(true)
        fillCtx.setAllowsAntialiasing(true)
        fillCtx.setFillColor(gray: 1.0, alpha: 1.0)
        fillCtx.addPath(path)
        fillCtx.drawPath(using: .eoFill)
    }

    if let strokeCtx = CGContext(data: &strokeMask, width: canvasSize, height: canvasSize, bitsPerComponent: 8, bytesPerRow: canvasSize, space: graySpace, bitmapInfo: CGImageAlphaInfo.none.rawValue) {
        strokeCtx.setShouldAntialias(true)
        strokeCtx.setAllowsAntialiasing(true)
        strokeCtx.setStrokeColor(gray: 1.0, alpha: 1.0)
        // Centered 3.6px stroke clipped to fillMask yields a crisp ~2px inner silhouette border with zero outer bleed
        strokeCtx.setLineWidth(3.6)
        strokeCtx.setLineJoin(.round)
        strokeCtx.addPath(path)
        strokeCtx.strokePath()
    }

    let countryDir = "\(manifest.outBaseDir)/\(country.id)"
    try FileManager.default.createDirectory(atPath: countryDir, withIntermediateDirectories: true)

    // Precompute inside-silhouette pixel list + statistics for meta.json
    var sumTemp: Double = 0
    var sumCo: Double = 0
    var sumNox: Double = 0
    var sumWind: Double = 0
    var insideCount: Int = 0

    struct HotspotCandidate {
        let sx: Double
        let sy: Double
        let val: Float
    }
    var lightningHotspots: [HotspotCandidate] = []
    var coHotspots: [HotspotCandidate] = []
    var noxHotspots: [HotspotCandidate] = []

    // Adaptive smoothing sigma based on how many 1024x1024 pixels span a single 2048x1024 global grid cell
    let srcPixelsLon = max(6.0, ((maxLon - minLon) / 360.0) * 2048.0)
    let srcPixelsLat = max(6.0, ((maxLat - minLat) / 180.0) * 1024.0)
    let canvasPxPerSrcCell = Float(max(drawnW / srcPixelsLon, drawnH / srcPixelsLat))

    for spec in layerSpecs {
        guard let field = fields[spec.id] else { continue }
        var canvasRaw = [Float](repeating: 0, count: canvasSize * canvasSize)

        for py in 0..<canvasSize {
            let rowOffset = py * canvasSize
            for px in 0..<canvasSize {
                let mIdx = rowOffset + px
                let maskVal = fillMask[mIdx]
                if maskVal == 0 { continue }

                let ix = Double(px) + 0.5
                let iy = Double(py) + 0.5
                let (lon, lat) = imgToGeo(ix, iy)
                let v = field.sampleBilinear(lon: lon, lat: lat)
                canvasRaw[mIdx] = v

                if spec.id == "temperature" && (px % 4 == 0 && py % 4 == 0) {
                    sumTemp += Double(v)
                    sumCo += Double(fields["chords"]!.sampleBilinear(lon: lon, lat: lat))
                    sumNox += Double(fields["bass"]!.sampleBilinear(lon: lon, lat: lat))
                    sumWind += Double(fields["wind"]!.sampleBilinear(lon: lon, lat: lat))
                    insideCount += 1

                    if px % 16 == 0 && py % 16 == 0 && maskVal > 200 {
                        let sx = ix / Double(canvasSize)
                        let sy = 1.0 - (iy / Double(canvasSize))
                        let lv = fields["melody"]!.sampleBilinear(lon: lon, lat: lat)
                        if lv > 0.16 {
                            lightningHotspots.append(HotspotCandidate(sx: sx, sy: sy, val: lv))
                        }
                        let cv = fields["chords"]!.sampleBilinear(lon: lon, lat: lat)
                        if cv > 0.25 {
                            coHotspots.append(HotspotCandidate(sx: sx, sy: sy, val: cv))
                        }
                        let nv = fields["bass"]!.sampleBilinear(lon: lon, lat: lat)
                        if nv > 0.25 {
                            noxHotspots.append(HotspotCandidate(sx: sx, sy: sy, val: nv))
                        }
                    }
                }
            }
        }

        let sigma: Float = spec.id == "melody"
            ? min(4.2, max(1.9, canvasPxPerSrcCell * 0.34))
            : min(16.0, max(2.8, canvasPxPerSrcCell * 0.85))
        let smoothed = smoothCanvasField(canvasRaw, mask: fillMask, size: canvasSize, sigma: sigma)

        // Compute country p10..p96 range so continuous plumes show internal structure instead of flat saturation
        var sampleVals: [Float] = []
        sampleVals.reserveCapacity(4096)
        for py in stride(from: 0, to: canvasSize, by: 8) {
            for px in stride(from: 0, to: canvasSize, by: 8) {
                let idx = py * canvasSize + px
                if fillMask[idx] > 200 {
                    sampleVals.append(smoothed[idx])
                }
            }
        }
        sampleVals.sort()
        let p12 = sampleVals.isEmpty ? Float(0.0) : sampleVals[Int(Double(sampleVals.count - 1) * 0.12)]
        let p98 = sampleVals.isEmpty ? Float(1.0) : max(p12 + 0.08, sampleVals[Int(Double(sampleVals.count - 1) * 0.98)])

        var outRGBA = [UInt8](repeating: 0, count: canvasSize * canvasSize * 4)
        for mIdx in 0..<(canvasSize * canvasSize) {
            let maskVal = fillMask[mIdx]
            if maskVal == 0 { continue } // Strictly RGBA(0,0,0,0) outside silhouette!

            let sv = smoothed[mIdx]
            let finalIntensity: Float
            if spec.id == "melody" {
                // Crisp circular radial spark glow without merging neighboring storm cells
                finalIntensity = min(1.0, pow(min(1.0, sv * 1.32), 1.18))
            } else {
                // Hybrid: 50% absolute NASA physical scale + 50% within-country structural gradient
                let localNorm = min(1.0, max(0.0, (sv - p12) / (p98 - p12)))
                finalIntensity = sv * 0.50 + localNorm * 0.50
            }

            let dataAlpha = Float(photoshopAlpha(value01: finalIntensity, layer: spec.id))
            // Crisp ~2px silhouette contour (alpha ~122 when isolated -> sharp rim without white blowout when 5 stack)
            let borderAlpha = (Float(strokeMask[mIdx]) / 255.0) * 122.0
            let combinedAlpha = max(dataAlpha, borderAlpha) * (Float(maskVal) / 255.0)
            let finalA = UInt8(min(235, max(1, Int(combinedAlpha.rounded()))))

            let p = mIdx * 4
            outRGBA[p] = spec.r
            outRGBA[p + 1] = spec.g
            outRGBA[p + 2] = spec.b
            outRGBA[p + 3] = finalA
        }

        let data = Data(outRGBA)
        guard let provider = CGDataProvider(data: data as CFData),
              let cgOut = CGImage(
                  width: canvasSize,
                  height: canvasSize,
                  bitsPerComponent: 8,
                  bitsPerPixel: 32,
                  bytesPerRow: canvasSize * 4,
                  space: rgbSpace,
                  bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
                  provider: provider,
                  decode: nil,
                  shouldInterpolate: true,
                  intent: .defaultIntent
              ) else {
            throw NSError(domain: "RenderCountryLayers", code: 5)
        }

        try saveCGImage(cgOut, to: "\(countryDir)/\(spec.id).png")
    }

    // Build georeferenced meta.json aligned 1:1 with the 1024x1024 silhouette
    let nSamples = max(1, insideCount)
    let meanTemp01 = sumTemp / Double(nSamples)
    let meanCo01 = sumCo / Double(nSamples)
    let meanNox01 = sumNox / Double(nSamples)
    let meanWind01 = sumWind / Double(nSamples)

    let absLat = abs(country.lat)
    let regionBpm = Int(min(110.0, max(66.0, (106.0 - absLat * 0.52 + (meanTemp01 - 0.5) * 12.0).rounded())))
    let windSpeedMs = ((3.2 + meanWind01 * 18.5) * 10.0).rounded() / 10.0

    let keyTable: [(String, String)] = [
        ("C", "Dó"), ("G", "Sol"), ("D", "Ré"), ("A", "Lá"), ("E", "Mi"), ("F", "Fá"), ("F#", "Fá#")
    ]
    let keyIdx = min(keyTable.count - 1, max(0, Int((meanTemp01 * Double(keyTable.count)).rounded()) % keyTable.count))
    let (keyEn, keyPt) = keyTable[keyIdx]

    let modePt: String
    let modeEn: String
    let chordsProg: [String]
    if meanCo01 < 0.28 {
        modePt = "Lídio Solar (Ar Limpo)"
        modeEn = "Solar Lydian (Clean Air)"
        chordsProg = ["\(keyEn)maj9", "\(keyEn)6", "Bm7", "F#m7"]
    } else if meanCo01 < 0.48 {
        modePt = "Mixolídio Tropical"
        modeEn = "Tropical Mixolydian"
        chordsProg = ["\(keyEn)add9", "Am7", "Gmaj7", "Asus4"]
    } else if meanCo01 < 0.65 {
        modePt = "Dórico Atmosférico"
        modeEn = "Atmospheric Dorian"
        chordsProg = ["\(keyEn)m9", "Csus2", "Eb6", "Fadd9"]
    } else {
        modePt = "Frígio Denso (Pluma CO)"
        modeEn = "Dense Phrygian (CO Plume)"
        chordsProg = ["\(keyEn)sus4", "Fmaj7", "Dm7", "\(keyEn)sus2"]
    }

    lightningHotspots.sort { $0.val > $1.val }
    coHotspots.sort { $0.val > $1.val }
    noxHotspots.sort { $0.val > $1.val }

    let topLightning = Array(lightningHotspots.prefix(32))
    let topCo = Array(coHotspots.prefix(8))
    let topNox = Array(noxHotspots.prefix(16))

    struct BeatEventOut: Encodable {
        let beat: Int
        let layer: String
        let source_x: Double
        let source_y: Double
        let pitch: Int
        let velocity: Double
        let isAnchor: Bool
    }

    var beatEvents: [BeatEventOut] = []
    let pentatonicOffsets = [0, 2, 4, 7, 9, 12, 14]
    for beatIdx in 0..<32 {
        if !topLightning.isEmpty {
            let shouldTrigger = topLightning.count >= 16 || (beatIdx % max(1, 32 / max(1, topLightning.count)) == 0)
            if shouldTrigger {
                let spot = topLightning[beatIdx % topLightning.count]
                let pitch = 69 + pentatonicOffsets[beatIdx % pentatonicOffsets.count]
                beatEvents.append(BeatEventOut(
                    beat: beatIdx,
                    layer: "melody",
                    source_x: (spot.sx * 1000).rounded() / 1000,
                    source_y: (spot.sy * 1000).rounded() / 1000,
                    pitch: pitch,
                    velocity: min(0.98, max(0.45, Double(spot.val))),
                    isAnchor: beatIdx % 4 == 0
                ))
                if spot.val > 0.45 && beatIdx % 2 == 1 {
                    let spkSpot = topLightning[(beatIdx + 3) % topLightning.count]
                    beatEvents.append(BeatEventOut(
                        beat: beatIdx,
                        layer: "sparkle",
                        source_x: (spkSpot.sx * 1000).rounded() / 1000,
                        source_y: (spkSpot.sy * 1000).rounded() / 1000,
                        pitch: pitch + 12,
                        velocity: min(0.85, Double(spkSpot.val) * 0.8),
                        isAnchor: false
                    ))
                }
            }
        }

        if beatIdx % 4 == 0 {
            let cx = topCo.isEmpty ? 0.5 : topCo[(beatIdx / 4) % topCo.count].sx
            let cy = topCo.isEmpty ? 0.5 : topCo[(beatIdx / 4) % topCo.count].sy
            beatEvents.append(BeatEventOut(
                beat: beatIdx,
                layer: "chords",
                source_x: (cx * 1000).rounded() / 1000,
                source_y: (cy * 1000).rounded() / 1000,
                pitch: 57 + (beatIdx / 4) % 5,
                velocity: min(0.9, 0.52 + meanCo01 * 0.4),
                isAnchor: true
            ))
        }

        if beatIdx % 2 == 0 {
            let bx = topNox.isEmpty ? 0.5 : topNox[(beatIdx / 2) % topNox.count].sx
            let by = topNox.isEmpty ? 0.42 : topNox[(beatIdx / 2) % topNox.count].sy
            beatEvents.append(BeatEventOut(
                beat: beatIdx,
                layer: "bass",
                source_x: (bx * 1000).rounded() / 1000,
                source_y: (by * 1000).rounded() / 1000,
                pitch: 36 + (beatIdx / 4) % 5,
                velocity: min(0.95, 0.55 + meanNox01 * 0.42),
                isAnchor: beatIdx % 4 == 0
            ))
        }
    }

    struct PngSpecOut: Encodable {
        let resolution: Int
        let marginRatio: Double
        let layers: [String]
    }
    struct TuningOut: Encodable {
        let bpm: Int
        let keyRoot: String
        let keyRootPt: String
        let modeNamePt: String
        let modeNameEn: String
        let chords: [String]
        let windMeanSpeed: Double
    }
    struct SessionOut: Encodable {
        let region: TuningOut
        let base: TuningOut
    }
    struct TelemetrySummaryOut: Encodable {
        let lightningHotspotCount: Int
        let meanTemperature01: Double
        let meanCo01: Double
        let meanNox01: Double
        let windMeanSpeedMs: Double
    }
    struct CountryMetaOut: Encodable {
        let id: String
        let namePt: String
        let nameEn: String
        let bbox: [Double]
        let pngSpec: PngSpecOut
        let session: SessionOut
        let telemetrySummary: TelemetrySummaryOut
        let beatEvents: [BeatEventOut]
    }

    let metaObj = CountryMetaOut(
        id: country.id,
        namePt: country.namePt,
        nameEn: country.nameEn,
        bbox: country.bbox,
        pngSpec: PngSpecOut(
            resolution: 1024,
            marginRatio: marginRatio,
            layers: ["melody", "chords", "temperature", "bass", "wind"]
        ),
        session: SessionOut(
            region: TuningOut(
                bpm: regionBpm,
                keyRoot: keyEn,
                keyRootPt: keyPt,
                modeNamePt: modePt,
                modeNameEn: modeEn,
                chords: chordsProg,
                windMeanSpeed: windSpeedMs
            ),
            base: TuningOut(
                bpm: 90,
                keyRoot: "A",
                keyRootPt: "Lá",
                modeNamePt: "Referência Neutra (90 BPM)",
                modeNameEn: "Neutral Reference (90 BPM)",
                chords: ["Am9", "Fmaj7", "Cmaj7", "Gsus4"],
                windMeanSpeed: windSpeedMs
            )
        ),
        telemetrySummary: TelemetrySummaryOut(
            lightningHotspotCount: lightningHotspots.count,
            meanTemperature01: (meanTemp01 * 1000).rounded() / 1000,
            meanCo01: (meanCo01 * 1000).rounded() / 1000,
            meanNox01: (meanNox01 * 1000).rounded() / 1000,
            windMeanSpeedMs: windSpeedMs
        ),
        beatEvents: beatEvents
    )

    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let jsonData = try encoder.encode(metaObj)
    try jsonData.write(to: URL(fileURLWithPath: "\(countryDir)/meta.json"))
    print("✓ Rendered \(country.id) (\(country.namePt)) — 5 PNGs (1024x1024) + meta.json (\(lightningHotspots.count) lightning pts)")
}
