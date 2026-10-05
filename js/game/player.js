/* =====================================================================
   PRIMEVAL FISHING — JUGADOR (primera persona)
   ---------------------------------------------------------------------
   Se mueve sobre la orilla dentro de zone.bounds. Puede vadear hasta
   ~0.7 m de profundidad (suena a agua). No puede caminar mientras hay
   un lance activo (como en Fishing Planet: la pesca es estática).
   ===================================================================== */
window.PF = window.PF || {};

PF.Player = function (camera, zone, colliders) {
  var U = PF.Util, Input = PF.Input;
  var self = this;
  this.pos = new THREE.Vector3();
  this.yaw = 0; this.pitch = -0.12;
  var EYE = 1.68, stepT = 0, bob = 0;

  this.teleport = function (spot) {
    self.pos.set(spot.x, 0, spot.z);
    self.pos.y = Math.max(zone.heightAt(spot.x, spot.z), -0.6);
    self.yaw = spot.yaw || 0;
    self.pitch = -0.12;
  };

  this.update = function (dt, canMove) {
    var look = Input.consumeLook();
    var sens = 0.0024 * PF.Save.data.settings.sensitivity;
    self.yaw -= look.x * sens;
    // Asistencia: girar suavemente hacia el pez durante el combate si se sale del encuadre
    if (self.assist) {
      var want = Math.atan2(-(self.assist.x - self.pos.x), -(self.assist.z - self.pos.z));
      var dy = want - self.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      if (Math.abs(dy) > 0.45) self.yaw += dy * Math.min(1, dt * 1.5) * (1 - 0.45 / Math.abs(dy));
    }
    self.pitch -= look.y * sens * (PF.Save.data.settings.invertY ? -1 : 1);
    self.pitch = U.clamp(self.pitch, -1.2, 0.9);

    var st = Input.state;
    var moving = false;
    if (canMove && (st.moveX || st.moveY)) {
      var speed = st.sprint ? 6.5 : 3.4;
      var sx = Math.sin(self.yaw), cz = Math.cos(self.yaw);
      // forward = -Z en espacio cámara
      var dx = (-sx * st.moveY + cz * st.moveX) * speed * dt;
      var dz = (-cz * st.moveY - sx * st.moveX) * speed * dt;
      var nx = self.pos.x + dx, nz = self.pos.z + dz;
      var b = zone.bounds;
      nx = U.clamp(nx, b.minX, b.maxX);
      var h = zone.heightAt(nx, nz);
      var minZ = zone.shoreZ(nx) + b.minZ;
      if (nz < minZ) nz = minZ;
      if (nz > b.maxZ) nz = b.maxZ;
      h = zone.heightAt(nx, nz);
      var blocked = h < -0.75 || h - self.pos.y > 1.2;
      for (var i = 0; i < colliders.length && !blocked; i++) {
        var c = colliders[i];
        if (Math.abs(c.x - nx) < 3 && Math.abs(c.z - nz) < 3 && Math.hypot(c.x - nx, c.z - nz) < c.r + 0.35) blocked = true;
      }
      if (!blocked) {
        self.pos.x = nx; self.pos.z = nz; moving = true;
        stepT += dt * (st.sprint ? 2.6 : 1.8);
        if (stepT > 1) {
          stepT = 0;
          if (h < -0.05) PF.Audio.play('stepWater', 0.35);
          else PF.Audio.play('step' + (1 + Math.floor(Math.random() * 4)), 0.35);
        }
      }
    }
    var ground = Math.max(zone.heightAt(self.pos.x, self.pos.z), -0.75);
    self.pos.y = U.lerp(self.pos.y, ground, Math.min(1, dt * 10));
    bob = moving ? bob + dt * (st.sprint ? 13 : 9) : bob * 0.9;
    camera.position.set(self.pos.x, self.pos.y + EYE + Math.sin(bob) * 0.04, self.pos.z);
    camera.rotation.set(self.pitch, self.yaw, 0, 'YXZ');
  };
};
