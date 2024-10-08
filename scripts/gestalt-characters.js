import { libWrapper } from './libWrapper/shim.js';

class GestaltActorSheet extends dnd5e.applications.actor.ActorSheet5eCharacter {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["dnd5e", "sheet", "actor", "character", "gestalt"]
    });
  }

  async getData() {
    const data = await super.getData();
    data.gestaltClass = this.actor.getFlag("dnd5e-gestalt-characters", "gestaltClass") || {};
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    this._injectGestaltOptions(html);
  }

  _injectGestaltOptions(html) {
    const classSelectHTML = `
      <div class="form-group gestalt-class-select">
        <label>Gestalt Class:</label>
        <select name="flags.dnd5e-gestalt-characters.gestaltClass">
          <option value="">None</option>
          ${Object.entries(CONFIG.DND5E.classes).map(([key, cls]) => 
            `<option value="${key}" ${this.actor.getFlag("dnd5e-gestalt-characters", "gestaltClass") === key ? 'selected' : ''}>${cls.label}</option>`
          ).join('')}
        </select>
      </div>
    `;
    html.find('.charlevel').after(classSelectHTML);
    html.find('.gestalt-class-select select').on('change', this._onGestaltClassChange.bind(this));
  }

  async _onGestaltClassChange(event) {
    event.preventDefault();
    const selectedClass = event.target.value;
    await this.actor.setFlag("dnd5e-gestalt-characters", "gestaltClass", selectedClass);
    
    // Recalculate HP based on the higher Hit Die between the two classes
    const primaryClass = this.actor.classes[Object.keys(this.actor.classes)[0]];
    const gestaltClass = CONFIG.DND5E.classes[selectedClass];
    
    if (primaryClass && gestaltClass) {
      const primaryHitDie = parseInt(primaryClass.hitDice.slice(1));
      const gestaltHitDie = parseInt(gestaltClass.hitDice.slice(1));
      const higherHitDie = Math.max(primaryHitDie, gestaltHitDie);
      
      // Update max HP (assuming Constitution modifier is already factored in)
      const level = this.actor.system.details.level;
      const conMod = this.actor.system.abilities.con.mod;
      const newMaxHP = (higherHitDie + conMod) + ((Math.floor(higherHitDie / 2) + 1 + conMod) * (level - 1));
      
      await this.actor.update({"system.attributes.hp.max": newMaxHP});
    }
    
    this.render();
  }
}

Hooks.once('init', () => {
  Actors.registerSheet("dnd5e", GestaltActorSheet, { 
    types: ["character"],
    makeDefault: true
  });
});

Hooks.on("createActor", (actor, data, options, userId) => {
  if (actor.type === "character") {
    // Initialize gestalt class data
    actor.setFlag("dnd5e-gestalt-characters", "gestaltClass", "");
  }
});

Hooks.on("dnd5e.preAdvancementLevelUp", (actor, advancementClass, level, changes) => {
  if (actor.type === "character") {
    const gestaltClass = actor.getFlag("dnd5e-gestalt-characters", "gestaltClass");
    if (gestaltClass) {
      // Add gestalt class features (this is a placeholder - actual implementation would be more complex)
      changes.push({
        "name": `Gestalt ${CONFIG.DND5E.classes[gestaltClass].label} Feature`,
        "type": "feat"
      });
      
      // Handle hit points
      const primaryClass = actor.classes[Object.keys(actor.classes)[0]];
      const gestaltClassConfig = CONFIG.DND5E.classes[gestaltClass];
      
      if (primaryClass && gestaltClassConfig) {
        const primaryHitDie = parseInt(primaryClass.hitDice.slice(1));
        const gestaltHitDie = parseInt(gestaltClassConfig.hitDice.slice(1));
        const higherHitDie = Math.max(primaryHitDie, gestaltHitDie);
        
        // Update max HP (assuming Constitution modifier is already factored in)
        const conMod = actor.system.abilities.con.mod;
        const hpIncrease = Math.floor(higherHitDie / 2 + 1) + conMod;
        
        changes.push({
          "path": "system.attributes.hp.max",
          "value": actor.system.attributes.hp.max + hpIncrease,
          "mode": CONST.ACTIVE_EFFECT_MODES.OVERRIDE
        });
      }
      
      // Do not add additional Hit Dice
    }
  }
});

// Wrapper for getHitPointsData to account for gestalt class
libWrapper.register('dnd5e-gestalt-characters', 'CONFIG.Actor.documentClass.prototype.getHitPointsData', function (wrapped, ...args) {
  const data = wrapped(...args);
  
  const gestaltClass = this.getFlag("dnd5e-gestalt-characters", "gestaltClass");
  if (gestaltClass) {
    const primaryClass = this.classes[Object.keys(this.classes)[0]];
    const gestaltClassConfig = CONFIG.DND5E.classes[gestaltClass];
    
    if (primaryClass && gestaltClassConfig) {
      const primaryHitDie = parseInt(primaryClass.hitDice.slice(1));
      const gestaltHitDie = parseInt(gestaltClassConfig.hitDice.slice(1));
      data.hitDice = `1d${Math.max(primaryHitDie, gestaltHitDie)}`;
    }
  }
  
  return data;
}, 'WRAPPER');

// Wrapper for getRollData to include gestalt class features in roll data
libWrapper.register('dnd5e-gestalt-characters', 'CONFIG.Actor.documentClass.prototype.getRollData', function (wrapped, ...args) {
  const data = wrapped(...args);
  
  const gestaltClass = this.getFlag("dnd5e-gestalt-characters", "gestaltClass");
  if (gestaltClass) {
    // Add gestalt class features to roll data (this is a placeholder - actual implementation would be more complex)
    data.gestalt = {
      class: gestaltClass,
      level: this.system.details.level,
      // Add other relevant gestalt data here
    };
  }
  
  return data;
}, 'WRAPPER');
