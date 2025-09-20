import { useState, useEffect } from 'react';
import { DataService } from '../services/dataService.ts';

interface Patient {
  patient_id: string;
  patient_name: string;
  last_session: string;
}

interface PatientSearchProps {
  onPatientSelect: (patientId: string, patientName: string) => void;
  selectedPatientId?: string;
}

export const PatientSearch = ({ onPatientSelect, selectedPatientId }: PatientSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPatients();
    } else {
      setPatients([]);
      setShowDropdown(false);
    }
  }, [searchQuery]);

  const searchPatients = async () => {
    setLoading(true);
    try {
      const results = await DataService.searchPatients(searchQuery);
      setPatients(results);
      setShowDropdown(true);
    } catch (error) {
      console.error('Error searching patients:', error);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSearchQuery(patient.patient_name);
    setShowDropdown(false);
    onPatientSelect(patient.patient_id, patient.patient_name);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length < 2) {
      setShowDropdown(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          placeholder="Buscar paciente por nombre o ID..."
          style={{
            width: '100%',
            padding: '0.75rem 3rem 0.75rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '1rem',
            backgroundColor: '#ffffff'
          }}
          onFocus={() => {
            if (patients.length > 0) setShowDropdown(true);
          }}
        />

        {/* Search icon */}
        <div style={{
          position: 'absolute',
          right: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#6b7280'
        }}>
          {loading ? (
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #f3f3f3',
              borderTop: '2px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && patients.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto',
          marginTop: '0.25rem'
        }}>
          {patients.map((patient, index) => (
            <div
              key={patient.patient_id}
              onClick={() => handlePatientSelect(patient)}
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderBottom: index < patients.length - 1 ? '1px solid #e5e7eb' : 'none',
                backgroundColor: selectedPatientId === patient.patient_id ? '#eff6ff' : 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  selectedPatientId === patient.patient_id ? '#eff6ff' : 'transparent';
              }}
            >
              <div style={{ fontWeight: '500', color: '#111827' }}>
                {patient.patient_name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                ID: {patient.patient_id} • Última sesión: {new Date(patient.last_session).toLocaleDateString('es-ES')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {showDropdown && patients.length === 0 && searchQuery.length >= 2 && !loading && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          marginTop: '0.25rem',
          padding: '1rem',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          No se encontraron pacientes
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};