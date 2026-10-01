def is_prime(n):
    if n < 2:
        return False
    for divisor in range(2, n // 2):
        if n % divisor == 0:
            return False
    return True

print(is_prime(4))
