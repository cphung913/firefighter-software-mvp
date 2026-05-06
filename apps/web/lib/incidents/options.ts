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

// ---------------------------------------------------------------------------
// Discipline-specific fields (stored under raw_data.discipline)
// ---------------------------------------------------------------------------

export type DisciplineSelectField = {
  key: string;
  type: "select";
  label: string;
  options: { value: string; label: string }[];
};

export type DisciplineNumberField = {
  key: string;
  type: "number";
  label: string;
};

export type DisciplineTextField = {
  key: string;
  type: "text";
  label: string;
};

export type DisciplineFieldConfig = DisciplineSelectField | DisciplineNumberField | DisciplineTextField;

export type DisciplineSectionConfig = {
  title: string;
  fields: DisciplineFieldConfig[];
};

export const DISCIPLINE_SECTIONS: Record<string, DisciplineSectionConfig[]> = {
  structure_fire: [
    {
      title: "Structure Fire Details",
      fields: [
        {
          key: "structure_type",
          type: "select",
          label: "Structure type",
          options: [
            { value: "single_family", label: "Single family" },
            { value: "multi_family", label: "Multi-family" },
            { value: "commercial", label: "Commercial" },
            { value: "industrial", label: "Industrial" },
            { value: "storage", label: "Storage" },
            { value: "other", label: "Other" },
          ],
        },
        {
          key: "fire_origin_floor",
          type: "number",
          label: "Floor of origin (1=ground)",
        },
        {
          key: "fire_spread",
          type: "select",
          label: "Fire spread",
          options: [
            { value: "confined_to_object", label: "Confined to object" },
            { value: "confined_to_room", label: "Confined to room" },
            { value: "confined_to_floor", label: "Confined to floor" },
            { value: "entire_structure", label: "Entire structure" },
            { value: "beyond_structure", label: "Beyond structure" },
          ],
        },
        {
          key: "detector_present",
          type: "select",
          label: "Detector",
          options: [
            { value: "none", label: "None" },
            { value: "present_operated", label: "Present — operated" },
            { value: "present_did_not_operate", label: "Present — did not operate" },
            { value: "undetermined", label: "Undetermined" },
          ],
        },
        {
          key: "estimated_loss",
          type: "number",
          label: "Estimated property loss ($)",
        },
      ],
    },
  ],
  medical_assist: [
    {
      title: "Medical Assist Details",
      fields: [
        { key: "patient_count", type: "number", label: "Number of patients" },
        {
          key: "patient_age_range",
          type: "select",
          label: "Patient age range",
          options: [
            { value: "infant", label: "Infant" },
            { value: "child", label: "Child" },
            { value: "adult", label: "Adult" },
            { value: "elderly", label: "Elderly" },
            { value: "unknown", label: "Unknown" },
          ],
        },
        {
          key: "injury_type",
          type: "select",
          label: "Injury / chief complaint",
          options: [
            { value: "cardiac", label: "Cardiac" },
            { value: "respiratory", label: "Respiratory" },
            { value: "trauma", label: "Trauma" },
            { value: "stroke", label: "Stroke" },
            { value: "diabetic", label: "Diabetic" },
            { value: "other", label: "Other" },
          ],
        },
        {
          key: "patient_disposition",
          type: "select",
          label: "Patient disposition",
          options: [
            { value: "treated_released", label: "Treated / released" },
            { value: "transported_ems", label: "Transported (EMS)" },
            { value: "transported_by_us", label: "Transported by us" },
            { value: "refusal", label: "Refusal" },
            { value: "doa", label: "DOA" },
          ],
        },
      ],
    },
  ],
  hazmat_gas_leak: [
    {
      title: "Hazmat / Gas Leak Details",
      fields: [
        { key: "material_name", type: "text", label: "Material / substance name" },
        {
          key: "hazmat_class",
          type: "select",
          label: "Hazmat class",
          options: [
            { value: "class_1_explosive", label: "Class 1 — Explosive" },
            { value: "class_2_gas", label: "Class 2 — Gas" },
            { value: "class_3_flammable_liquid", label: "Class 3 — Flammable liquid" },
            { value: "class_4_flammable_solid", label: "Class 4 — Flammable solid" },
            { value: "class_8_corrosive", label: "Class 8 — Corrosive" },
            { value: "class_9_misc", label: "Class 9 — Miscellaneous" },
            { value: "unknown", label: "Unknown" },
          ],
        },
        {
          key: "release_type",
          type: "select",
          label: "Release type",
          options: [
            { value: "controlled", label: "Controlled" },
            { value: "uncontrolled", label: "Uncontrolled" },
            { value: "threatened_release", label: "Threatened release" },
            { value: "no_release", label: "No release" },
          ],
        },
        {
          key: "action_zone_radius_ft",
          type: "number",
          label: "Isolation zone radius (ft)",
        },
      ],
    },
  ],
  motor_vehicle_collision: [
    {
      title: "Motor Vehicle Collision Details",
      fields: [
        { key: "vehicles_involved", type: "number", label: "Number of vehicles" },
        {
          key: "road_type",
          type: "select",
          label: "Road type",
          options: [
            { value: "highway", label: "Highway" },
            { value: "arterial", label: "Arterial" },
            { value: "residential", label: "Residential" },
            { value: "parking_lot", label: "Parking lot" },
            { value: "other", label: "Other" },
          ],
        },
        { key: "patient_count", type: "number", label: "Patients (incl. pedestrians)" },
        {
          key: "entrapment",
          type: "select",
          label: "Entrapment",
          options: [
            { value: "none", label: "None" },
            { value: "light", label: "Light" },
            { value: "heavy", label: "Heavy" },
            { value: "unknown", label: "Unknown" },
          ],
        },
      ],
    },
  ],
  rescue_extrication: [
    {
      title: "Rescue / Extrication Details",
      fields: [
        {
          key: "rescue_type",
          type: "select",
          label: "Rescue type",
          options: [
            { value: "vehicle", label: "Vehicle" },
            { value: "machinery", label: "Machinery" },
            { value: "confined_space", label: "Confined space" },
            { value: "trench", label: "Trench" },
            { value: "structural_collapse", label: "Structural collapse" },
            { value: "water", label: "Water" },
            { value: "high_angle", label: "High angle" },
            { value: "other", label: "Other" },
          ],
        },
        { key: "persons_rescued", type: "number", label: "Persons rescued" },
      ],
    },
  ],
};
