export const WAD = 10n ** 18n;
export const UINT144_MAX = 2n ** 144n - 1n;
export const UINT152_MAX = 2n ** 152n - 1n;
export const UINT256_MAX = 2n ** 256n - 1n;

declare global {
  interface BigInt {
    toJSON(): string;
    fromWad(): number;
    toNumber(): number;
    abs(): bigint;
    sqrtWad(): bigint;
    sqrt(): bigint;
    lnWad(): bigint;
    log10Wad(): bigint;
    mulWad(y: bigint): bigint;
    divWad(y: bigint): bigint;
    max(y: bigint): bigint;
    min(y: bigint): bigint;
  }
}

BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

BigInt.prototype.fromWad = function (): number {
  // Note: this has precision issues, but
  // seems mostly fine in practice. Could
  // employ a more complex algo but don't
  // want this to become a bottleneck.
  return this.toNumber() / 1e18;
};

BigInt.prototype.toNumber = function (): number {
  return Number(this);
};

BigInt.prototype.abs = function (): bigint {
  return this.valueOf() < 0n ? -this.valueOf() : this.valueOf();
};

// port of solady sqrtWad
BigInt.prototype.sqrtWad = function (): bigint {
  let z = 10n ** 9n;
  let value = this.valueOf();
  if (value <= UINT256_MAX / (10n ** 36n - 1n)) {
    value *= WAD;
    z = 1n;
  }
  z *= value.sqrt();
  return z;
};

// via https://www.npmjs.com/package/bigint-isqrt
BigInt.prototype.sqrt = function (): bigint {
  let value = this.valueOf();

  if (value < 2n) {
    return value;
  }

  if (value < 16n) {
    return BigInt(Math.sqrt(value.toNumber()) | 0);
  }

  let x0, x1;
  if (value < 1n << 52n) {
    x1 = BigInt(Math.sqrt(value.toNumber()) | 0) - 3n;
  } else {
    let vlen = value.toString().length;
    if (!(vlen & 1)) {
      x1 = 10n ** BigInt(vlen / 2);
    } else {
      x1 = 4n * 10n ** BigInt((vlen / 2) | 0);
    }
  }

  do {
    x0 = x1;
    x1 = (value / x0 + x0) >> 1n;
  } while (x0 !== x1 && x0 !== x1 - 1n);

  return x0;
};

// via https://github.com/vectorized/solady/blob/main/src/utils/FixedPointMathLib.sol
BigInt.prototype.lnWad = function (): bigint {
  let x = this.valueOf();

  if (x <= 0n) throw new Error("LN_WAD_UNDEFINED");

  let r: bigint = 0n;

  // We want to convert `x` from `10**18` fixed point to `2**96` fixed point.
  // We do this by multiplying by `2**96 / 10**18`. But since
  // `ln(x * C) = ln(x) + ln(C)`, we can simply do nothing here
  // and add `ln(2**96 / 10**18)` at the end.

  // Compute `k = log2(x) - 96`, `r = 159 - k = 255 - log2(x) = 255 ^ log2(x)`.
  r = (0xffffffffffffffffffffffffffffffffn < x ? 1n : 0n) << 7n;
  r = r | ((0xffffffffffffffffn < x >> r ? 1n : 0n) << 6n);
  r = r | ((0xffffffffn < x >> r ? 1n : 0n) << 5n);
  r = r | ((0xffffn < x >> r ? 1n : 0n) << 4n);
  r = r | ((0xffn < x >> r ? 1n : 0n) << 3n);

  r =
    r ^
    ((0xf8f9f9faf9fdfafbf9fdfcfdfafbfcfef9fafdfafcfcfbfefafafcfbffffffffn >>
      (8n * (31n - (0x1fn & (0x8421084210842108cc6318c6db6d54ben >> (x >> r)))))) &
      0xffn);

  // Reduce range of x to (1, 2) * 2**96
  // ln(2^k * x) = k * ln(2) + ln(x)
  x = (x << r) >> 159n;

  // Evaluate using a (8, 8)-term rational approximation.
  // `p` is made monic, we will multiply by a scale factor later.
  let p =
    (((43456485725739037958740375743393n +
      (((24828157081833163892658089445524n +
        (((3273285459638523848632254066296n + x) * x) >> 96n)) *
        x) >>
        96n)) *
      x) >>
      96n) -
    11111509109440967052023855526967n;
  p = ((p * x) >> 96n) - 45023709667254063763336534515857n;
  p = ((p * x) >> 96n) - 14706773417378608786704636184526n;
  p = p * x - (795164235651350426258249787498n << 96n);
  // We leave `p` in `2**192` basis so we don't need to scale it back up for the division.

  // `q` is monic by convention.
  let q = 5573035233440673466300451813936n + x;
  q = 71694874799317883764090561454958n + ((x * q) >> 96n);
  q = 283447036172924575727196451306956n + ((x * q) >> 96n);
  q = 401686690394027663651624208769553n + ((x * q) >> 96n);
  q = 204048457590392012362485061816622n + ((x * q) >> 96n);
  q = 31853899698501571402653359427138n + ((x * q) >> 96n);
  q = 909429971244387300277376558375n + ((x * q) >> 96n);

  // `p / q` is in the range `(0, 0.125) * 2**96`.

  // Finalization, we need to:
  // - Multiply by the scale factor `s = 5.549…`.
  // - Add `ln(2**96 / 10**18)`.
  // - Add `k * ln(2)`.
  // - Multiply by `10**18 / 2**96 = 5**18 >> 78`.

  // The q polynomial is known not to have zeros in the domain.
  // No scaling required because p is already `2**96` too large.
  p = p / q;
  // Multiply by the scaling factor: `s * 5**18 * 2**96`, base is now `5**18 * 2**192`.
  p = 1677202110996718588342820967067443963516166n * p;
  // Add `ln(2) * k * 5**18 * 2**192`.
  p = 16597577552685614221487285958193947469193820559219878177908093499208371n * (159n - r) + p;
  // Add `ln(2**96 / 10**18) * 5**18 * 2**192`.
  p = 600920179829731861736702779321621459595472258049074101567377883020018308n + p;
  // Base conversion: mul `2**18 / 2**192`.
  r = p >> 174n;

  return r;
};

BigInt.prototype.log10Wad = function (): bigint {
  // change of base formula, log10(x) = ln(x) / ln(10)
  return (this.valueOf().lnWad() * WAD) / 2302585092994045683n; // divWad inlined.
};

BigInt.prototype.mulWad = function (y: bigint): bigint {
  return (this.valueOf() * y) / WAD;
};

BigInt.prototype.divWad = function (y: bigint): bigint {
  return (this.valueOf() * WAD) / y;
};

BigInt.prototype.max = function (y: bigint): bigint {
  return this.valueOf() > y ? this.valueOf() : y;
};

BigInt.prototype.min = function (y: bigint): bigint {
  return this.valueOf() < y ? this.valueOf() : y;
};
