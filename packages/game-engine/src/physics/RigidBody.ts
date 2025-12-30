/**
 * RigidBody
 * Basic physics simulation component
 */

import { Vector2 } from '../math/Vector2.ts';
import { AABB } from './AABB.ts';

export interface RigidBodyConfig {
  mass?: number;
  drag?: number;
  angularDrag?: number;
  gravityScale?: number;
  isStatic?: boolean;
  isTrigger?: boolean;
  bounciness?: number;
}

export class RigidBody {
  // Transform
  position: Vector2;
  rotation: number = 0;

  // Linear motion
  velocity: Vector2 = Vector2.zero();
  acceleration: Vector2 = Vector2.zero();

  // Angular motion
  angularVelocity: number = 0;
  angularAcceleration: number = 0;

  // Physics properties
  mass: number;
  inverseMass: number;
  drag: number;
  angularDrag: number;
  gravityScale: number;
  bounciness: number;

  // Flags
  isStatic: boolean;
  isTrigger: boolean;
  isGrounded: boolean = false;

  // Collision shape
  bounds: AABB;

  // Forces (cleared each frame)
  private accumulatedForce: Vector2 = Vector2.zero();
  private accumulatedTorque: number = 0;

  constructor(position: Vector2, bounds: AABB, config: RigidBodyConfig = {}) {
    this.position = position.clone();
    this.bounds = bounds;

    this.mass = config.mass ?? 1.0;
    this.inverseMass = this.mass > 0 ? 1.0 / this.mass : 0;
    this.drag = config.drag ?? 0.01;
    this.angularDrag = config.angularDrag ?? 0.05;
    this.gravityScale = config.gravityScale ?? 1.0;
    this.isStatic = config.isStatic ?? false;
    this.isTrigger = config.isTrigger ?? false;
    this.bounciness = config.bounciness ?? 0.0;

    // Static objects have infinite mass
    if (this.isStatic) {
      this.inverseMass = 0;
    }
  }

  /**
   * Apply a force to the rigidbody
   */
  applyForce(force: Vector2): void {
    if (this.isStatic) return;
    this.accumulatedForce = this.accumulatedForce.add(force);
  }

  /**
   * Apply an impulse (instantaneous force)
   */
  applyImpulse(impulse: Vector2): void {
    if (this.isStatic) return;
    this.velocity = this.velocity.add(impulse.multiply(this.inverseMass));
  }

  /**
   * Apply a torque (rotational force)
   */
  applyTorque(torque: number): void {
    if (this.isStatic) return;
    this.accumulatedTorque += torque;
  }

  /**
   * Set velocity directly
   */
  setVelocity(velocity: Vector2): void {
    if (this.isStatic) return;
    this.velocity = velocity.clone();
  }

  /**
   * Add to velocity
   */
  addVelocity(delta: Vector2): void {
    if (this.isStatic) return;
    this.velocity = this.velocity.add(delta);
  }

  /**
   * Update physics (Euler integration)
   */
  update(deltaTime: number, gravity: Vector2 = Vector2.zero()): void {
    if (this.isStatic) return;

    // Apply gravity
    if (this.gravityScale !== 0) {
      this.applyForce(gravity.multiply(this.mass * this.gravityScale));
    }

    // Calculate acceleration from accumulated forces
    this.acceleration = this.accumulatedForce.multiply(this.inverseMass);

    // Update velocity
    this.velocity = this.velocity.add(this.acceleration.multiply(deltaTime));

    // Apply linear drag
    const dragFactor = 1.0 - this.drag;
    this.velocity = this.velocity.multiply(Math.pow(dragFactor, deltaTime));

    // Update position
    this.position = this.position.add(this.velocity.multiply(deltaTime));

    // Update AABB position
    this.bounds.center = this.position.clone();

    // Angular motion
    this.angularVelocity += this.accumulatedTorque * this.inverseMass * deltaTime;

    // Apply angular drag
    const angularDragFactor = 1.0 - this.angularDrag;
    this.angularVelocity *= Math.pow(angularDragFactor, deltaTime);

    // Update rotation
    this.rotation += this.angularVelocity * deltaTime;

    // Clear accumulated forces
    this.accumulatedForce = Vector2.zero();
    this.accumulatedTorque = 0;
  }

  /**
   * Semi-implicit Euler (more stable for games)
   */
  updateSemiImplicit(deltaTime: number, gravity: Vector2 = Vector2.zero()): void {
    if (this.isStatic) return;

    // Apply gravity
    if (this.gravityScale !== 0) {
      this.applyForce(gravity.multiply(this.mass * this.gravityScale));
    }

    // Calculate acceleration
    this.acceleration = this.accumulatedForce.multiply(this.inverseMass);

    // Update velocity first (semi-implicit)
    this.velocity = this.velocity.add(this.acceleration.multiply(deltaTime));

    // Apply drag
    const dragFactor = 1.0 - this.drag;
    this.velocity = this.velocity.multiply(Math.pow(dragFactor, deltaTime));

    // Then update position using new velocity
    this.position = this.position.add(this.velocity.multiply(deltaTime));

    // Update AABB
    this.bounds.center = this.position.clone();

    // Angular motion
    this.angularVelocity += this.accumulatedTorque * this.inverseMass * deltaTime;
    const angularDragFactor = 1.0 - this.angularDrag;
    this.angularVelocity *= Math.pow(angularDragFactor, deltaTime);
    this.rotation += this.angularVelocity * deltaTime;

    // Clear forces
    this.accumulatedForce = Vector2.zero();
    this.accumulatedTorque = 0;
  }

  /**
   * Verlet integration (better energy conservation)
   */
  updateVerlet(deltaTime: number, gravity: Vector2 = Vector2.zero()): void {
    if (this.isStatic) return;

    // Apply gravity
    if (this.gravityScale !== 0) {
      this.applyForce(gravity.multiply(this.mass * this.gravityScale));
    }

    // Calculate acceleration
    this.acceleration = this.accumulatedForce.multiply(this.inverseMass);

    // Store old position
    const oldPosition = this.position.clone();

    // Verlet integration: new_pos = pos + velocity*dt + 0.5*acceleration*dt^2
    const velocityTerm = this.velocity.multiply(deltaTime);
    const accelerationTerm = this.acceleration.multiply(0.5 * deltaTime * deltaTime);
    this.position = this.position.add(velocityTerm).add(accelerationTerm);

    // Update velocity: v = (new_pos - old_pos) / dt
    this.velocity = this.position.subtract(oldPosition).divide(deltaTime);

    // Apply drag
    const dragFactor = 1.0 - this.drag;
    this.velocity = this.velocity.multiply(Math.pow(dragFactor, deltaTime));

    // Update AABB
    this.bounds.center = this.position.clone();

    // Angular motion (using semi-implicit)
    this.angularVelocity += this.accumulatedTorque * this.inverseMass * deltaTime;
    const angularDragFactor = 1.0 - this.angularDrag;
    this.angularVelocity *= Math.pow(angularDragFactor, deltaTime);
    this.rotation += this.angularVelocity * deltaTime;

    // Clear forces
    this.accumulatedForce = Vector2.zero();
    this.accumulatedTorque = 0;
  }

  /**
   * Resolve collision with another rigidbody
   */
  resolveCollision(other: RigidBody, normal: Vector2, penetration: number): void {
    if (this.isTrigger || other.isTrigger) return;

    // Don't resolve if both are static
    if (this.isStatic && other.isStatic) return;

    // Separate objects
    const totalInverseMass = this.inverseMass + other.inverseMass;
    if (totalInverseMass > 0) {
      const separationPerIMass = normal.multiply(penetration / totalInverseMass);

      if (!this.isStatic) {
        this.position = this.position.add(separationPerIMass.multiply(this.inverseMass));
        this.bounds.center = this.position.clone();
      }

      if (!other.isStatic) {
        other.position = other.position.subtract(separationPerIMass.multiply(other.inverseMass));
        other.bounds.center = other.position.clone();
      }
    }

    // Calculate relative velocity
    const relativeVelocity = this.velocity.subtract(other.velocity);
    const velocityAlongNormal = relativeVelocity.dot(normal);

    // Don't resolve if velocities are separating
    if (velocityAlongNormal > 0) return;

    // Calculate restitution (bounciness)
    const restitution = Math.min(this.bounciness, other.bounciness);

    // Calculate impulse scalar
    const impulseScalar = -(1 + restitution) * velocityAlongNormal / totalInverseMass;

    // Apply impulse
    const impulse = normal.multiply(impulseScalar);

    if (!this.isStatic) {
      this.velocity = this.velocity.add(impulse.multiply(this.inverseMass));
    }

    if (!other.isStatic) {
      other.velocity = other.velocity.subtract(impulse.multiply(other.inverseMass));
    }
  }

  /**
   * Get kinetic energy
   */
  getKineticEnergy(): number {
    if (this.isStatic) return 0;
    return 0.5 * this.mass * this.velocity.lengthSquared();
  }

  /**
   * Get momentum
   */
  getMomentum(): Vector2 {
    if (this.isStatic) return Vector2.zero();
    return this.velocity.multiply(this.mass);
  }

  /**
   * Stop all motion
   */
  stop(): void {
    this.velocity = Vector2.zero();
    this.acceleration = Vector2.zero();
    this.angularVelocity = 0;
    this.angularAcceleration = 0;
    this.accumulatedForce = Vector2.zero();
    this.accumulatedTorque = 0;
  }
}
