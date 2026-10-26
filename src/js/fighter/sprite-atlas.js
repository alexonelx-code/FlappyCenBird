(() => {
  'use strict';

  const cachedFrames = new Map();

  // Lower pixels may belong to this pose; the taller leading gutter belongs to the preceding pose.
  function extractFrame(pixels, atlasWidth, atlasHeight, frameWidth, frameHeight, index, columns,
    padding = 14, leadingBleed = Math.floor(frameHeight * 0.15)) {
    const cellX = index % columns * frameWidth;
    const cellY = Math.floor(index / columns) * frameHeight;
    const left = Math.max(0, cellX - padding);
    const top = cellY;
    const right = Math.min(atlasWidth, cellX + frameWidth + padding);
    const bottom = Math.min(atlasHeight, cellY + frameHeight + padding);
    const bleedTop = cellY > 0 ? cellY + leadingBleed : cellY;
    const width = right - left;
    const height = bottom - top;
    const area = width * height;
    const visited = new Uint8Array(area);
    const queue = new Int32Array(area);
    const torsoLeft = cellX + frameWidth * 0.28;
    const torsoRight = cellX + frameWidth * 0.72;
    const torsoTop = cellY + frameHeight * 0.28;
    const torsoBottom = cellY + frameHeight * 0.76;
    let selected = null;

    for (let start = 0; start < area; start += 1) {
      if (visited[start]) continue;
      const imageX = left + start % width;
      const imageY = top + Math.floor(start / width);
      if (pixels[(imageY * atlasWidth + imageX) * 4 + 3] === 0) {
        visited[start] = 1;
        continue;
      }

      let head = 0;
      let tail = 0;
      let torsoPixels = 0;
      let cellPixels = 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      visited[start] = 1;
      queue[tail++] = start;

      while (head < tail) {
        const current = queue[head++];
        const x = left + current % width;
        const y = top + Math.floor(current / width);
        if (x >= cellX && x < cellX + frameWidth && y >= cellY && y < cellY + frameHeight) {
          cellPixels += 1;
          if (x >= torsoLeft && x <= torsoRight && y >= torsoTop && y <= torsoBottom) torsoPixels += 1;
        }
        if (y >= bleedTop) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }

        const xInRoi = current % width;
        const neighbors = [current - width, current + width,
          xInRoi > 0 ? current - 1 : -1,
          xInRoi + 1 < width ? current + 1 : -1];
        neighbors.forEach((next) => {
          if (next < 0 || next >= area || visited[next]) return;
          const nextX = left + next % width;
          const nextY = top + Math.floor(next / width);
          visited[next] = 1;
          if (pixels[(nextY * atlasWidth + nextX) * 4 + 3] > 0) queue[tail++] = next;
        });
      }

      if (!cellPixels || maxY < 0) continue;
      const score = torsoPixels * 1000 + cellPixels;
      if (!selected || score > selected.score) selected = { score, start, minX, minY, maxX, maxY };
    }

    if (!selected) return null;

    const frameLeft = selected.minX;
    const frameTop = selected.minY;
    const frameOutWidth = selected.maxX - frameLeft + 1;
    const frameOutHeight = selected.maxY - frameTop + 1;
    const framePixels = new Uint8ClampedArray(frameOutWidth * frameOutHeight * 4);
    const included = new Uint8Array(area);
    let head = 0;
    let tail = 0;
    included[selected.start] = 1;
    queue[tail++] = selected.start;
    while (head < tail) {
      const current = queue[head++];
      const x = left + current % width;
      const y = top + Math.floor(current / width);
      if (y >= bleedTop) {
        const sourceOffset = (y * atlasWidth + x) * 4;
        const targetOffset = ((y - frameTop) * frameOutWidth + x - frameLeft) * 4;
        framePixels.set(pixels.subarray(sourceOffset, sourceOffset + 4), targetOffset);
      }
      const xInRoi = current % width;
      const neighbors = [current - width, current + width,
        xInRoi > 0 ? current - 1 : -1,
        xInRoi + 1 < width ? current + 1 : -1];
      neighbors.forEach((next) => {
        if (next < 0 || next >= area || included[next]) return;
        const nextX = left + next % width;
        const nextY = top + Math.floor(next / width);
        included[next] = 1;
        if (pixels[(nextY * atlasWidth + nextX) * 4 + 3] > 0) queue[tail++] = next;
      });
    }

    return {
      x: frameLeft - cellX,
      y: frameTop - cellY,
      width: frameOutWidth,
      height: frameOutHeight,
      pixels: framePixels
    };
  }

  function getFrame(image, frameWidth, frameHeight, index) {
    if (typeof document === 'undefined' || !image || !image.naturalWidth || !image.naturalHeight) return null;
    const key = `${image.src}:${frameWidth}x${frameHeight}`;
    if (!cachedFrames.has(key)) {
      try {
        const atlasWidth = image.naturalWidth;
        const atlasHeight = image.naturalHeight;
        const columns = Math.floor(atlasWidth / frameWidth);
        const rows = Math.floor(atlasHeight / frameHeight);
        if (!columns || !rows) return null;
        const source = document.createElement('canvas');
        source.width = atlasWidth;
        source.height = atlasHeight;
        const sourceContext = source.getContext('2d', { willReadFrequently: true });
        if (!sourceContext) return null;
        sourceContext.drawImage(image, 0, 0);
        const pixels = sourceContext.getImageData(0, 0, atlasWidth, atlasHeight).data;
        const frames = [];
        for (let frameIndex = 0; frameIndex < columns * rows; frameIndex += 1) {
          const frame = extractFrame(pixels, atlasWidth, atlasHeight, frameWidth, frameHeight, frameIndex, columns);
          if (!frame) {
            frames.push(null);
            continue;
          }
          const canvas = document.createElement('canvas');
          canvas.width = frame.width;
          canvas.height = frame.height;
          const context = canvas.getContext('2d');
          if (!context) {
            frames.push(null);
            continue;
          }
          const pixelsOut = context.createImageData(frame.width, frame.height);
          pixelsOut.data.set(frame.pixels);
          context.putImageData(pixelsOut, 0, 0);
          frames.push({ image: canvas, x: frame.x, y: frame.y, width: frame.width, height: frame.height });
        }
        cachedFrames.set(key, frames);
      } catch (_) {
        cachedFrames.set(key, null);
      }
    }
    const frames = cachedFrames.get(key);
    return frames && frames[index] || null;
  }

  globalThis.CenFighterSpriteAtlas = Object.freeze({ extractFrame, getFrame });
})();
