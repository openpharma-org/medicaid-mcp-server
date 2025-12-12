/**
 * Medicaid Dataset Mappings
 *
 * Dataset IDs and access methods from data.medicaid.gov
 * Source: DKAN platform (hybrid CSV + API approach)
 *
 * ARCHITECTURE:
 * - Small datasets (<50 MB): CSV download + in-memory cache (NADAC, Enrollment)
 * - Large datasets (>100 MB): DKAN API queries (Drug Rebate, Drug Utilization, Federal Upper Limits)
 *
 * DKAN API endpoint: https://data.medicaid.gov/api/1/datastore/query/{dataset-id}/0
 */

const DATASETS = {
  // NADAC (National Average Drug Acquisition Cost)
  NADAC_2024: {
    id: '99315a95-37ac-4eee-946a-3c523b4c481e',
    downloadUrl: 'https://download.medicaid.gov/data/nadac-national-average-drug-acquisition-cost-12-25-2024.csv',
    metadataUrl: 'https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/99315a95-37ac-4eee-946a-3c523b4c481e',
    name: 'NADAC (National Average Drug Acquisition Cost) 2024',
    category: 'drug_pricing',
    update_frequency: 'weekly',
    description: 'Weekly NADAC pricing data for prescription drugs',
    cacheTime: 24 * 60 * 60 * 1000,  // 24 hours
    estimatedSize: '123 MB',
    estimatedRecords: '1,497,925',
    accessMethod: 'csv'  // CSV download + in-memory cache
  },

  // Enrollment & Eligibility
  ENROLLMENT_SNAPSHOT: {
    id: '6165f45b-ca93-5bb5-9d06-db29c692a360',
    downloadUrl: 'https://download.medicaid.gov/data/pi-dataset-november-2025release.csv',
    metadataUrl: 'https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/6165f45b-ca93-5bb5-9d06-db29c692a360',
    name: 'Medicaid and CHIP Eligibility Operations and Enrollment Snapshot Data',
    category: 'enrollment',
    update_frequency: 'monthly',
    description: 'Monthly enrollment and eligibility processing data by state',
    cacheTime: 7 * 24 * 60 * 60 * 1000,  // 7 days
    estimatedSize: '3.6 MB',
    estimatedRecords: '10,098',
    accessMethod: 'csv'  // CSV download + in-memory cache
  },

  // Drug Rebate Program
  DRUG_REBATE: {
    id: '0ad65fe5-3ad3-5d79-a3f9-7893ded7963a',
    downloadUrl: 'https://download.medicaid.gov/data/drugproducts3q_2025Updated11132025.csv',
    metadataUrl: 'https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/0ad65fe5-3ad3-5d79-a3f9-7893ded7963a',
    name: 'Drug Products in the Medicaid Drug Rebate Program',
    category: 'drug_pricing',
    update_frequency: 'quarterly',
    description: 'Active drugs reported by manufacturers under MDRP (NDC, unit type, FDA approval, innovator/non-innovator)',
    cacheTime: 7 * 24 * 60 * 60 * 1000,  // 7 days
    estimatedSize: '291 MB',
    estimatedRecords: '~3M+',
    accessMethod: 'dkan_api'  // DKAN API queries (too large for CSV)
  },

  // State Drug Utilization
  DRUG_UTILIZATION: {
    id: '61729e5a-7aa8-448c-8903-ba3e0cd0ea3c',
    downloadUrl: 'https://download.medicaid.gov/data/sdud-2024-updated-dec2025.csv',
    metadataUrl: 'https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/61729e5a-7aa8-448c-8903-ba3e0cd0ea3c',
    name: 'State Drug Utilization Data 2024',
    category: 'utilization',
    update_frequency: 'quarterly',
    description: 'Drug utilization by state (NDC, prescriptions, dollars reimbursed) - aggregate level',
    cacheTime: 7 * 24 * 60 * 60 * 1000,  // 7 days
    estimatedSize: '192 MB',
    estimatedRecords: '5,284,306',
    accessMethod: 'dkan_api'  // DKAN API queries (too large for CSV)
  },

  // Federal Upper Limits
  FEDERAL_UPPER_LIMITS: {
    id: 'ce4cf49b-a21b-5a53-bbc3-509414940847',
    downloadUrl: 'https://download.medicaid.gov/data/aca-federal-upper-limits-11242025.csv',
    metadataUrl: 'https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/ce4cf49b-a21b-5a53-bbc3-509414940847',
    name: 'ACA Federal Upper Limits',
    category: 'drug_pricing',
    update_frequency: 'monthly',
    description: 'FUL based on weighted average AMP for therapeutically equivalent multiple source drugs',
    cacheTime: 7 * 24 * 60 * 60 * 1000,  // 7 days
    estimatedSize: '196 MB',
    estimatedRecords: '2,085,934',
    accessMethod: 'dkan_api'  // DKAN API queries (too large for CSV, growing monthly)
  }
};

/**
 * Get dataset configuration by category and purpose
 */
function getDataset(category, purpose) {
  switch (category) {
    case 'nadac':
    case 'drug_pricing':
      if (purpose === 'rebate') {
        return DATASETS.DRUG_REBATE;
      } else if (purpose === 'ful') {
        return DATASETS.FEDERAL_UPPER_LIMITS;
      }
      return DATASETS.NADAC_2024;

    case 'enrollment':
      return DATASETS.ENROLLMENT_SNAPSHOT;

    case 'utilization':
      return DATASETS.DRUG_UTILIZATION;

    default:
      throw new Error(`Unknown dataset category: ${category}`);
  }
}

/**
 * Get all datasets by category
 */
function getDatasetsByCategory(category) {
  return Object.values(DATASETS).filter(ds => ds.category === category);
}

/**
 * List all available datasets
 */
function listDatasets() {
  return Object.entries(DATASETS).map(([key, dataset]) => ({
    key,
    ...dataset
  }));
}

module.exports = {
  DATASETS,
  getDataset,
  getDatasetsByCategory,
  listDatasets
};
