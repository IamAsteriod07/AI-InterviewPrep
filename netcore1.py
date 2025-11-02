
from bisect import bisect_left
from typing import List


def find_maximum_remainder(n: int, arr: List[int], k: int) -> int:
    if k == 1:
        return 0

    evens: List[int] = []
    odds: List[int] = []

    for value in arr:
        remainder = value % k
        if remainder < 0:
            remainder += k
        if value & 1:
            odds.append(remainder)
        else:
            evens.append(remainder)

    evens.sort()
    odds.sort()

    best = 0
    target_best = k - 1

    for even_rem in evens:
        target = k - even_rem
        idx = bisect_left(odds, target)

        if idx > 0:
            candidate = even_rem + odds[idx - 1]
            if candidate > best:
                best = candidate
                if best == target_best:
                    return best

        if idx < len(odds):
            candidate = (even_rem + odds[idx]) % k
            if candidate > best:
                best = candidate
                if best == target_best:
                    return best

    return best


def count_special_ranges(n: int, k: int, lower: int, upper: int, types: str, specials: str) -> int:
    special_set = set(specials)
    binary = [1 if ch in special_set else 0 for ch in types]

    def count_at_most(limit: int) -> int:
        if limit < 0:
            return 0
        total = 0
        current = 0
        left = 0
        for right, val in enumerate(binary):
            current += val
            while current > limit:
                current -= binary[left]
                left += 1
            total += right - left + 1
        return total

    return count_at_most(upper) - count_at_most(lower - 1)