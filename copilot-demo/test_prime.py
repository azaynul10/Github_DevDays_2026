import unittest
from prime import is_prime

class PrimeTests(unittest.TestCase):
    def test_negative(self): self.assertFalse(is_prime(-1))
    def test_zero(self): self.assertFalse(is_prime(0))
    def test_one(self): self.assertFalse(is_prime(1))
    def test_two(self): self.assertTrue(is_prime(2))
    def test_three(self): self.assertTrue(is_prime(3))
    def test_four(self): self.assertFalse(is_prime(4))
    def test_nine(self): self.assertFalse(is_prime(9))
    def test_twenty_five(self): self.assertFalse(is_prime(25))

if __name__ == '__main__':
    unittest.main()
