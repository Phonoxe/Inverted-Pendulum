import math
import random


class CartPoleEnv:
    """
    CartPole environment with one-directional coupling:
    - The cart's acceleration affects the pendulum (realistic inertial effect).
    - The pendulum does NOT exert a reaction force on the cart (simplified).

    The agent directly sets the cart's velocity each step.

    State:
        x        - cart position (m)
        v_cart   - cart velocity (m/s), set directly by the agent
        theta    - pole angle from vertical (rad), 0 = upright
        omega    - pole angular velocity (rad/s)

    Action:
        A float in [-1, 1], scaled to [-MAX_CART_SPEED, MAX_CART_SPEED].

    Episode:
        Ends after max_steps regardless of pole angle.
    """

    G = 9.81
    DT = 0.02
    POLE_LENGTH = 1.0
    MAX_CART_SPEED = 5.0
    MAX_STEPS = 500

    def __init__(self, max_steps=None):
        self.max_steps = max_steps or self.MAX_STEPS
        self.x = 0.0
        self.v_cart = 0.0
        self.theta = 0.0
        self.omega = 0.0
        self.step_count = 0
        self.done = False

    def reset(self, seed=None):
        if seed is not None:
            random.seed(seed)
        self.x = random.uniform(-0.5, 0.5)
        self.v_cart = 0.0
        self.theta = random.uniform(-0.1, 0.1)
        self.omega = random.uniform(-0.05, 0.05)
        self.step_count = 0
        self.done = False
        return self._get_state()

    def step(self, action: float):
        if self.done:
            raise RuntimeError("Episode is done. Call reset() first.")

        # --- Cart dynamics ---
        # Derive acceleration from velocity change so we can couple it
        # into the pendulum equation below.
        v_cart_prev = self.v_cart
        self.v_cart = float(action) * self.MAX_CART_SPEED
        self.x += self.v_cart * self.DT
        a_cart = (self.v_cart - v_cart_prev) / self.DT

        # --- Pendulum dynamics (Euler) ---
        # Full equation for a pendulum whose pivot is on a moving base:
        #   α = -(g/L)·sin(θ) - (a_cart/L)·cos(θ)
        #
        # The second term is the inertial effect: when the cart accelerates
        # to the right, the pendulum base is pulled right, which (from the
        # pole's reference frame) acts like a leftward pseudo-force at the
        # bob — tipping the pole in the opposite direction of cart motion.
        alpha = -(self.G / self.POLE_LENGTH) * math.sin(self.theta) - (
            a_cart / self.POLE_LENGTH
        ) * math.cos(self.theta)
        self.omega += alpha * self.DT
        self.omega *= 0.998  # small damping to prevent numerical blowup
        self.theta += self.omega * self.DT
        self.theta = (self.theta + math.pi) % (2 * math.pi) - math.pi

        self.step_count += 1
        # self.done = self.step_count >= self.max_steps

        return self._get_state(), self.done

    def _get_state(self):
        return (self.x, self.v_cart, self.theta, self.omega)

    def __repr__(self):
        return (
            f"CartPoleEnv(x={self.x:.3f}, v={self.v_cart:.3f}, "
            f"theta={math.degrees(self.theta):.2f}°, omega={self.omega:.3f})"
        )
