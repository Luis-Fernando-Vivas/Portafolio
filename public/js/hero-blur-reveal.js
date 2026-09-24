(function () {
  var STEP = 35 // ms between each word starting its transition
  var WORD_DURATION = 380 // matches the .hbr-word transition duration in hero-blur-reveal.css
  var BUTTONS_DURATION = 320 // matches the Buttons > * transition duration + its own small delay
  var GAP = 80 // pause between each stage

  var heading = document.querySelector('h1.framer-styles-preset-1hexgp2')
  if (!heading) return
  var headingWrap = heading.parentElement
  var subtitleWrap = headingWrap && headingWrap.nextElementSibling
  var subtitleP = subtitleWrap && subtitleWrap.querySelector('p')

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // The hero video autoplays on a loop; with reduced motion keep it still
  // on its poster frame instead.
  var heroVideo = document.querySelector('header[data-framer-name="Hero Section"] video.automind-hero-video')
  if (heroVideo && reduceMotion) {
    heroVideo.removeAttribute('autoplay')
    heroVideo.pause()
  }

  function splitIntoWords(el) {
    var text = el.textContent
    var chunks = text.split(/(\s+)/)
    var visual = document.createElement('span')
    visual.setAttribute('aria-hidden', 'true')

    var words = []
    chunks.forEach(function (chunk) {
      if (!chunk.length) return
      if (/^\s+$/.test(chunk)) {
        visual.appendChild(document.createTextNode(chunk))
        return
      }
      var wordEl = document.createElement('span')
      wordEl.className = 'hbr-word'
      wordEl.textContent = chunk
      visual.appendChild(wordEl)
      words.push(wordEl)
    })

    var srOnly = document.createElement('span')
    srOnly.className = 'hbr-sr-only'
    srOnly.textContent = text

    el.textContent = ''
    el.appendChild(visual)
    el.appendChild(srOnly)

    return words
  }

  var words = splitIntoWords(heading)
  if (subtitleP) words = words.concat(splitIntoWords(subtitleP))

  if (reduceMotion || !words.length) {
    words.forEach(function (w) {
      w.style.opacity = '1'
      w.style.filter = 'none'
    })
    return
  }

  words.forEach(function (w, i) {
    w.style.transitionDelay = i * STEP + 'ms'
  })

  var textDuration = (words.length - 1) * STEP + WORD_DURATION

  // Reveals the hero image as a single top-to-bottom wave: each block's gray
  // placeholder pops in (row by row, jittered within the row), and shortly
  // after — a short constant lag later, not waiting for the whole grid to
  // finish — that same block swaps for the real image underneath it. The two
  // "sweeps" end up overlapping almost entirely, one chasing the other.
  function pixelRevealImage(callback) {
    var wrap = document.querySelector('header[data-framer-name="Hero Section"] [data-framer-name="Image Wrap"]')
    // The hero media is a looping <video> (an <img> works too). drawImage()
    // takes either; with the video it paints whatever frame is current, so
    // the reveal shows the animation already playing underneath.
    var img = wrap && wrap.querySelector('video, img')
    if (!img) {
      callback()
      return
    }
    var isVideo = img.tagName === 'VIDEO'

    var container = img.parentElement
    var priorPosition = container.style.position
    if (!priorPosition) container.style.position = 'relative'

    var canvas = document.createElement('canvas')
    canvas.className = 'hpr-canvas'
    img.classList.add('hpr-hidden-img')
    container.appendChild(canvas)
    document.documentElement.classList.add('hbr-image-active')

    // Builds the block grid covering the entire image container. Each
    // block's image-reveal delay is its own gray-appear delay plus a short
    // constant lag, so the image wave trails close behind the gray wave
    // instead of waiting for the gray wave to finish everywhere first.
    function buildBlocks(w, h, blockSize, sweepDuration, jitter, lag, lagJitter) {
      var rows = Math.ceil(h / blockSize)
      var sweep = sweepDuration - jitter
      var blocks = []

      for (var by = 0, ry = 0; by < h; by += blockSize, ry++) {
        var blockH = Math.min(blockSize, h - by)
        var rowT = rows > 1 ? ry / (rows - 1) : 0
        for (var bx = 0; bx < w; bx += blockSize) {
          var blockW = Math.min(blockSize, w - bx)
          var gray = 222 + Math.round(Math.random() * 33) // 222–255, some near-white for spacing
          var delay1 = rowT * sweep + Math.random() * jitter
          blocks.push({
            x: bx,
            y: by,
            w: blockW,
            h: blockH,
            gray: gray,
            delay1: delay1,
            delay2: delay1 + lag + Math.random() * lagJitter,
          })
        }
      }

      return blocks
    }

    function start() {
      var rect = img.getBoundingClientRect()
      var w = Math.max(1, Math.round(rect.width))
      var h = Math.max(1, Math.round(rect.height))
      var dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      var ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      var BLOCK = 24
      var SWEEP_DURATION = 1000 // how long the gray wave takes to reach the bottom row
      var JITTER = 180 // per-block random delay within its row's window
      var FADE_IN = 110 // ms for each block to fade in/out
      var LAG = 180 // gap between a block's gray appearing and its image appearing
      var LAG_JITTER = 100 // extra randomness so the image wave isn't a rigid copy of the gray wave
      var TOTAL = SWEEP_DURATION + JITTER + LAG + LAG_JITTER + FADE_IN

      var blocks = buildBlocks(w, h, BLOCK, SWEEP_DURATION, JITTER, LAG, LAG_JITTER)

      // The <img> uses object-fit: contain, so its natural aspect ratio may
      // not match the box's — the browser letterboxes it (pillarbox/gap on
      // two sides) rather than stretching it. Replicate that exact mapping
      // here so a block's canvas-space rect maps to the same source pixels
      // the real <img> shows; otherwise the canvas render subtly stretches
      // the image and it visibly "snaps" when swapped back to the real <img>.
      var nW = isVideo ? img.videoWidth : img.naturalWidth
      var nH = isVideo ? img.videoHeight : img.naturalHeight
      var boxRatio = w / h
      var imgRatio = nW / nH
      var dispW, dispH, offX, offY
      if (imgRatio > boxRatio) {
        dispW = w
        dispH = w / imgRatio
        offX = 0
        offY = (h - dispH) / 2
      } else {
        dispH = h
        dispW = h * imgRatio
        offY = 0
        offX = (w - dispW) / 2
      }
      var scaleX = nW / dispW
      var scaleY = nH / dispH

      var startTime = null

      function drawFrame(elapsed) {
        ctx.clearRect(0, 0, w, h)

        for (var i = 0; i < blocks.length; i++) {
          var block = blocks[i]
          var appearAlpha = Math.max(0, Math.min(1, (elapsed - block.delay1) / FADE_IN))
          if (appearAlpha <= 0) continue

          // The image fading in also fades the gray square out underneath it,
          // so the square is visibly removed as part of the reveal instead of
          // sitting there while the image just gets layered on top of it.
          var imgAlpha = Math.max(0, Math.min(1, (elapsed - block.delay2) / FADE_IN))
          var grayAlpha = appearAlpha * (1 - imgAlpha)

          if (grayAlpha > 0) {
            ctx.fillStyle = 'rgba(' + block.gray + ',' + block.gray + ',' + block.gray + ',' + grayAlpha.toFixed(3) + ')'
            ctx.fillRect(block.x, block.y, block.w, block.h)
          }

          if (imgAlpha > 0) {
            // Clip the block against the image's actual displayed rect
            // (accounting for the object-fit: contain letterbox); parts of
            // a block outside that rect have no image content to draw.
            var ix0 = Math.max(block.x, offX)
            var iy0 = Math.max(block.y, offY)
            var ix1 = Math.min(block.x + block.w, offX + dispW)
            var iy1 = Math.min(block.y + block.h, offY + dispH)
            if (ix1 > ix0 && iy1 > iy0) {
              ctx.globalAlpha = imgAlpha
              ctx.drawImage(
                img,
                (ix0 - offX) * scaleX,
                (iy0 - offY) * scaleY,
                (ix1 - ix0) * scaleX,
                (iy1 - iy0) * scaleY,
                ix0,
                iy0,
                ix1 - ix0,
                iy1 - iy0
              )
              ctx.globalAlpha = 1
            }
          }
        }
      }

      function finish() {
        canvas.remove()
        img.classList.remove('hpr-hidden-img')
        if (!priorPosition) container.style.position = ''
        callback()
      }

      function frame(ts) {
        if (startTime === null) startTime = ts
        var elapsed = ts - startTime
        drawFrame(Math.min(elapsed, TOTAL))
        if (elapsed < TOTAL) {
          requestAnimationFrame(frame)
        } else {
          finish()
        }
      }

      requestAnimationFrame(frame)
    }

    if (isVideo ? img.readyState >= 2 : img.complete && img.naturalWidth) {
      start()
    } else {
      img.addEventListener(isVideo ? 'loadeddata' : 'load', start, { once: true })
    }
  }

  function revealFollowUps() {
    setTimeout(function () {
      document.documentElement.classList.add('hbr-buttons-ready')
      setTimeout(function () {
        document.documentElement.classList.add('hbr-image-active')
      }, BUTTONS_DURATION + GAP)
    }, textDuration + GAP)
  }

  function reveal() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.classList.add('hbr-ready')
        revealFollowUps()
      })
    })
  }

  var overlay = document.getElementById('automind-loading')
  if (overlay) {
    window.addEventListener('automind:loaded', reveal, { once: true })
  } else {
    reveal()
  }

  // Plays the pixel-sweep effect only when the hero image leaves the
  // viewport and comes back into view (e.g. scroll away then back up),
  // not on the page's initial appearance. The real <img> is hidden the
  // moment it leaves the screen (not when it comes back), so there's no
  // flash of the old, un-animated image when it re-enters.
  function watchReentry() {
    if (reduceMotion || !('IntersectionObserver' in window)) return
    var wrap = document.querySelector('header[data-framer-name="Hero Section"] [data-framer-name="Image Wrap"]')
    var img = wrap && wrap.querySelector('video, img')
    if (!img) return

    var hasLeftView = false
    var isFirstCallback = true
    var isAnimating = false

    var observer = new IntersectionObserver(
      function (entries) {
        var entry = entries[0]
        if (isFirstCallback) {
          isFirstCallback = false
          return
        }
        if (entry.isIntersecting) {
          if (hasLeftView && !isAnimating) {
            hasLeftView = false
            isAnimating = true
            pixelRevealImage(function () {
              isAnimating = false
            })
          }
        } else {
          hasLeftView = true
          img.classList.add('hpr-hidden-img')
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(wrap)
  }

  watchReentry()
})()
