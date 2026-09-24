const token = localStorage.getItem('clinicToken');
const message = document.querySelector('#message');
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusClass = (status = 'booked') => String(status).toLowerCase();

function renderStats(stats) {
  const totalUsers = stats.users.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const totalAppointments = stats.appointments.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const bookedCount = stats.appointments.find((row) => String(row.status).toLowerCase() === 'booked')?.count || 0;
  const completedCount = stats.appointments.find((row) => String(row.status).toLowerCase() === 'completed')?.count || 0;

  document.querySelector('#stats').innerHTML = `
    <article class="admin-stat-card">
      <span class="specialty">Users</span>
      <h3>${totalUsers}</h3>
      <p>Registered accounts</p>
    </article>
    <article class="admin-stat-card">
      <span class="specialty">Doctors</span>
      <h3>${stats.doctors}</h3>
      <p>Active clinicians</p>
    </article>
    <article class="admin-stat-card">
      <span class="specialty">Patients</span>
      <h3>${stats.patients || 0}</h3>
      <p>Patient records</p>
    </article>
    <article class="admin-stat-card">
      <span class="specialty">Appointments</span>
      <h3>${totalAppointments}</h3>
      <p>${bookedCount} booked · ${completedCount} completed</p>
    </article>
  `;
}

function renderDoctors(doctors, specializations) {
  const roster = document.querySelector('#roster');
  roster.innerHTML = doctors.map((doctor) => {
    const id = doctor.doctor_id;
    const options = specializations.map((item) => `<option value="${item.specialization_id}" ${item.name === doctor.specialization ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
    return `
      <article class="doctor admin-doctor">
        <span class="specialty">${escapeHtml(doctor.specialization)}</span>
        <h3>${escapeHtml(doctor.full_name)}</h3>
        <p>₹${Number(doctor.consultation_fee || 0).toFixed(0)} · ${doctor.years_experience || 0} years · ${doctor.daily_capacity || 0}/day</p>
        <div class="admin-form">
          <label>
            <span>Specialization</span>
            <select data-specialization="${id}">${options}</select>
          </label>
          <div class="admin-field-row">
            <label>
              <span>Fee</span>
              <input data-fee="${id}" type="number" min="0" value="${Number(doctor.consultation_fee || 0).toFixed(0)}" placeholder="Fee in ₹">
            </label>
            <label>
              <span>Capacity</span>
              <input data-capacity="${id}" type="number" min="1" value="${doctor.daily_capacity || 1}" placeholder="Daily capacity">
            </label>
          </div>
          <button class="button button-primary save-doctor" type="button" data-role="save-doctor" data-id="${id}">Save profile</button>
          <div class="availability-form">
            <div class="admin-field-row">
              <label>
                <span>Day</span>
                <select data-day="${id}">
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                  <option value="0">Sunday</option>
                </select>
              </label>
              <label>
                <span>Start</span>
                <input data-start="${id}" type="time" value="09:00">
              </label>
              <label>
                <span>End</span>
                <input data-end="${id}" type="time" value="17:00">
              </label>
            </div>
            <button class="button button-secondary add-availability" type="button" data-role="add-availability" data-id="${id}">Add availability</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-role="save-doctor"]').forEach((button) => {
    button.onclick = async () => {
      const id = Number(button.dataset.id);
      const specializationSelect = document.querySelector(`[data-specialization="${id}"]`);
      const feeInput = document.querySelector(`[data-fee="${id}"]`);
      const capacityInput = document.querySelector(`[data-capacity="${id}"]`);
      await api(`/doctors/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          specializationId: Number(specializationSelect.value),
          consultationFee: Number(feeInput.value || 0),
          dailyCapacity: Number(capacityInput.value || 1)
        })
      });
      message.textContent = 'Doctor profile updated successfully.';
      await load();
    };
  });

  document.querySelectorAll('[data-role="add-availability"]').forEach((button) => {
    button.onclick = async () => {
      const id = Number(button.dataset.id);
      const day = document.querySelector(`[data-day="${id}"]`)?.value;
      const start = document.querySelector(`[data-start="${id}"]`)?.value;
      const end = document.querySelector(`[data-end="${id}"]`)?.value;
      await api('/availability', {
        method: 'POST',
        body: JSON.stringify({ doctorId: id, dayOfWeek: Number(day), startTime: start, endTime: end })
      });
      message.textContent = 'Availability window added.';
      await load();
    };
  });
}

function renderPatients(patients) {
  const patientsTable = document.querySelector('#patientsTable');
  if (!patientsTable) return;
  patientsTable.innerHTML = patients.length ? patients.map((patient) => `
    <tr>
      <td>${escapeHtml(patient.full_name || 'Unknown')}</td>
      <td>${escapeHtml(patient.email || '—')}</td>
      <td>${formatDate(patient.date_of_birth)}</td>
      <td>${escapeHtml(patient.phone || '—')}</td>
      <td>${escapeHtml(patient.address || '—')}</td>
    </tr>
  `).join('') : '<tr><td colspan="5">No patient records found.</td></tr>';
}

function renderAppointments(appointments) {
  const appointmentsTable = document.querySelector('#appointmentsTable');
  if (!appointmentsTable) return;
  appointmentsTable.innerHTML = appointments.length ? appointments.map((appointment) => {
    const status = String(appointment.status || 'booked');
    const canComplete = status !== 'completed' && status !== 'cancelled';
    const canCancel = status === 'booked';
    return `
      <tr>
        <td>#${appointment.appointment_id}</td>
        <td>${escapeHtml(appointment.patient_id || '—')}</td>
        <td>${escapeHtml(appointment.doctor_id || '—')}</td>
        <td>${formatDate(appointment.appointment_date)}</td>
        <td>${escapeHtml(appointment.start_time || '—')} - ${escapeHtml(appointment.end_time || '—')}</td>
        <td><span class="status-badge ${statusClass(status)}">${status}</span></td>
        <td>
          <div class="table-actions">
            ${canComplete ? `<button type="button" class="small-table-button" data-role="status" data-id="${appointment.appointment_id}" data-status="completed">Complete</button>` : ''}
            ${canCancel ? `<button type="button" class="small-table-button danger" data-role="status" data-id="${appointment.appointment_id}" data-status="cancelled">Cancel</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="7">No appointments scheduled.</td></tr>';

  document.querySelectorAll('[data-role="status"]').forEach((button) => {
    button.onclick = async () => {
      const id = Number(button.dataset.id);
      const status = button.dataset.status;
      await api(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      message.textContent = `Appointment ${status}.`;
      await load();
    };
  });
}

async function load() {
  if (!token) {
    message.textContent = 'Sign in with an administrator account first.';
    return;
  }

  try {
    const [stats, doctors, specializations, patients, appointments] = await Promise.all([
      api('/dashboard/admin'),
      api('/doctors'),
      api('/specializations'),
      api('/patients'),
      api('/appointments')
    ]);

    const statsData = {
      ...stats,
      patients: Array.isArray(patients) ? patients.length : 0
    };

    renderStats(statsData);
    renderDoctors(doctors, specializations);
    renderPatients(patients);
    renderAppointments(appointments);
  } catch (error) {
    message.textContent = error.message === 'FORBIDDEN' ? 'This page requires an admin account.' : error.message;
  }
}

document.querySelector('#signOut').onclick = () => {
  localStorage.clear();
  location.href = '/';
};

load();

