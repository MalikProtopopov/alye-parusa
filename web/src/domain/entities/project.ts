export interface GeoLocation {
  /** Республика Дагестан */
  region: string;
  /** Карабудахкентский район */
  district: string;
  /** напротив аэропорта */
  landmark: string;
  /** первая береговая линия Каспийского моря */
  seaLine: string;
}

/** A single headline figure (e.g. «46 корпусов»). */
export interface ProjectFact {
  id: string;
  value: string;
  label: string;
  detail?: string;
}

export interface Project {
  /** Русское имя — «Алые Паруса». */
  name: string;
  /** Латиница-вордмарк для hero — «ALYE PARUSA». */
  wordmark: string;
  tagline: string;
  /** «апарт-комплекс» */
  kind: string;
  location: GeoLocation;
  cadastralNumber: string;
  facts: ProjectFact[];
}
