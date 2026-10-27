// 데모용 배우 프로필 사진(public/actors). 번호는 아래 순서와 같다.
// 1 여·숏컷  2 남·소년미  3 여·중년  4 여·곱슬  5 남·중년
// 6 남·버즈컷  7 여·긴 머리  8 여·숏컷  9 남·장발
export function demoFace(n: number) {
  return `/actors/actor-${String(n).padStart(2, '0')}.jpg`;
}
