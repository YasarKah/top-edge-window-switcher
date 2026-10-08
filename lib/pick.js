'use strict';

// Verilen noktayi iceren ILK pencereyi dondurur. Liste ustten alta siralanmis
// gelmelidir, yani ilk eslesme en ustteki penceredir.
//
// Kenar testi bilerek baslangicta kapsayici (`>=`): panelsiz bir monitorde
// buyutulmus pencerenin cercevesi y=0'dan baslar ve kullanici pencereyi tam o
// satirdan tutar. Baslangic kenari disarida birakilirsa surukleme hicbir zaman
// baslamaz, ki bu modul tam olarak onu duzeltmek icin var.
export function pickWindowAt(windows, x, y) {
    for (const window of windows) {
        const frame = window.frame;
        if (!frame)
            continue;
        if (x < frame.x || x >= frame.x + frame.width)
            continue;
        if (y < frame.y || y >= frame.y + frame.height)
            continue;
        return window;
    }
    return null;
}
