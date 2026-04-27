export const NERIS_INCIDENT_TYPES = [
  { value: "structure_fire", label: "Structure fire" },
  { value: "vehicle_fire", label: "Vehicle fire" },
  { value: "medical_assist", label: "Medical assist" },
  { value: "motor_vehicle_collision", label: "Motor vehicle collision" },
  { value: "rescue_extrication", label: "Rescue / extrication" },
  { value: "hazmat_gas_leak", label: "Hazmat / gas leak" },
  { value: "public_service", label: "Public service" },
  { value: "false_alarm", label: "False alarm" },
] as const;

export const ACTION_TAKEN_OPTIONS = [
  { value: "fire_attack", label: "Fire attack" },
  { value: "overhaul", label: "Overhaul" },
  { value: "ventilation", label: "Ventilation" },
  { value: "patient_care", label: "Patient care" },
  { value: "traffic_control", label: "Traffic control" },
  { value: "water_supply", label: "Water supply" },
  { value: "hazmat_isolation", label: "Hazmat isolation" },
  { value: "scene_investigation", label: "Scene investigation" },
] as const;

export const PROPERTY_USE_OPTIONS = [
  { value: "one_two_family_dwelling", label: "1-2 family dwelling" },
  { value: "multi_family_residential", label: "Multi-family residential" },
  { value: "commercial_mercantile", label: "Commercial / mercantile" },
  { value: "industrial_utility", label: "Industrial / utility" },
  { value: "roadway_highway", label: "Roadway / highway" },
  { value: "wildland_open_land", label: "Wildland / open land" },
  { value: "public_assembly", label: "Public assembly" },
  { value: "other", label: "Other" },
] as const;
