export class Random {
    constructor(seed = 12345) {
        this.seed = seed;
    }

    // Linear Congruential Generator (LCG)
    next() {
        // Constants for a standard LCG
        const a = 1664525;
        const c = 1013904223;
        const m = 4294967296; // 2^32
        
        this.seed = (a * this.seed + c) % m;
        return this.seed / m;
    }

    // Retorna um inteiro entre min (inclusivo) e max (exclusivo)
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min)) + min;
    }
}
