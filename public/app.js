const state = { token: localStorage.getItem('clinicToken'), register: false, registerRole: 'patient', doctors: [], specializations: [], selectedDoctorId: null };
const $ = (id) => document.getElementById(id);

function syncRegisterFields() {
  const isRegister = state.register;
  const accountType = $('accountType');
  const doctorFields = document.querySelectorAll('.doctor-only');
  const registerFields = document.querySelectorAll('.register-only');

  registerFields.forEach((field) => field.classList.toggle('hidden', !isRegister));

  if (accountType) {
    accountType.classList.toggle('hidden', !isRegister);
    accountType.value = accountType.value || 'patient';
  }

  const isDoctor = isRegister && accountType && accountType.value === 'doctor';
  doctorFields.forEach((field) => field.classList.toggle('hidden', !isDoctor));
}

function normalizeDoctorName(name) {
  return name && name.startsWith('Dr.') ? name : `Dr. ${name || 'Doctor'}`;
}

function setDate() {
  const tomorrow = new Date(Date.now() + 86400000);
  const dateInput = $('date');
  if (!dateInput) return;
  dateInput.value = tomorrow.toISOString().slice(0, 10);
  dateInput.min = new Date().toISOString().slice(0, 10);
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };

  const response = await fetch(`/api${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

function renderSpecializations() {
  const grid = $('specializationsGrid');
  if (!grid) return;
  const counts = {};
  state.doctors.forEach((doctor) => {
    counts[doctor.specialization] = (counts[doctor.specialization] || 0) + 1;
  });

  grid.innerHTML = state.specializations.map((spec) => `
    <article class="specialty-card">
      <div class="icon-wrap" aria-hidden="true">${spec.name === 'Cardiology' ? '❤️' : spec.name === 'Dermatology' ? '🩺' : spec.name === 'Emergency Medicine' ? '🚑' : spec.name === 'Endocrinology' ? '🧬' : spec.name === 'Gastroenterology' ? '🧠' : spec.name === 'Neurology' ? '🧠' : spec.name === 'Orthopedics' ? '🦴' : spec.name === 'Pediatrics' ? '👶' : '🩺'}</div>
      <h3>${spec.name}</h3>
      <p>${spec.description || 'Specialized care for your health needs.'}</p>
      <div class="card-meta">
        <span>${counts[spec.name] || 0} doctors</span>
        <a href="#doctors">View Doctors →</a>
      </div>
    </article>
  `).join('');
}

function renderDoctors() {
  const list = $('doctorList');
  const filter = $('specialityFilter');
  if (!list) return;

  let doctors = [...state.doctors];
  const searchTerm = $('doctorSearch') ? $('doctorSearch').value.trim().toLowerCase() : '';
  const selectedSpecialization = filter ? filter.value : 'all';
  const sortValue = $('doctorSort') ? $('doctorSort').value : 'rating';

  if (selectedSpecialization !== 'all') {
    doctors = doctors.filter((doctor) => doctor.specialization === selectedSpecialization);
  }

  if (searchTerm) {
    doctors = doctors.filter((doctor) => {
      const name = (doctor.full_name || '').toLowerCase();
      const specialization = (doctor.specialization || '').toLowerCase();
      return name.includes(searchTerm) || specialization.includes(searchTerm);
    });
  }

  doctors.sort((a, b) => {
    if (sortValue === 'experience') return Number(b.years_experience) - Number(a.years_experience);
    if (sortValue === 'fee') return Number(a.consultation_fee || 0) - Number(b.consultation_fee || 0);
    return Number(b.avg_rating || 0) - Number(a.avg_rating || 0);
  });

  list.innerHTML = doctors.length ? doctors.map((doctor) => {
    const initials = (doctor.full_name || 'Dr').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const fullName = normalizeDoctorName(doctor.full_name);
    return `
      <article class="doctor-card">
        <div class="doctor-top">
          <div class="doctor-avatar" aria-hidden="true">${initials}</div>
          <span class="bullet-pill">${doctor.specialization}</span>
        </div>
        <div>
          <h3>${fullName}</h3>
          <div class="meta-list">
            <span>${doctor.years_experience || 0} years experience</span>
            <span>★★★★★ ${Number(doctor.avg_rating || 0).toFixed(1)}</span>
            <span>₹${Number(doctor.consultation_fee || 0).toFixed(0)} consultation</span>
          </div>
        </div>
        <div class="card-row">
          <span class="price">Available today</span>
          <div class="button-group">
            <button type="button" class="button button-secondary small-button" data-action="profile" data-doctor-id="${doctor.doctor_id}">View Profile</button>
            <button type="button" class="button button-primary small-button" data-action="schedule" data-doctor-id="${doctor.doctor_id}">Book</button>
          </div>
        </div>
      </article>
    `;
  }).join('') : '<p class="message">No doctors match your current filters.</p>';
}

function fillSpecializationFilters() {
  const filter = $('specialityFilter');
  const schedulerSelect = $('specialization');
  if (!filter || !schedulerSelect) return;

  filter.innerHTML = `<option value="all">All specializations</option>${state.specializations.map((spec) => `<option value="${spec.name}">${spec.name}</option>`).join('')}`;
  schedulerSelect.innerHTML = state.specializations.map((spec) => `<option value="${spec.specialization_id}">${spec.name}</option>`).join('');
}

function setMatchResult(data) {
  const empty = $('matchEmpty');
  const wrap = $('matchDetailsWrap');
  if (!empty || !wrap) return;

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  $('score').textContent = `${data.score}/100`;
  $('doctorName').textContent = normalizeDoctorName(data.doctorName || data.doctor?.full_name || 'Doctor');
  $('matchDetails').textContent = `${data.specialization} • ${data.appointmentDate || 'Selected date'} at ${data.startTime || 'TBD'}`;
  $('doctorExperience').textContent = `${data.yearsExperience || 0} years`;
  $('doctorFee').textContent = `₹${Number(data.consultationFee || 0).toFixed(0)}`;
  $('doctorAvailability').textContent = data.appointmentDate || 'Today';
  $('doctorLocation').textContent = 'DK Hospital';
  const initials = (data.doctorName || 'Doctor').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();
  $('resultAvatar').textContent = initials;
}

function closeDoctorModal() {
  const modal = $('doctorModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openDoctorModal(doctor) {
  const modal = $('doctorModal');
  const content = $('modalContent');
  if (!modal || !content) return;

  const initials = (doctor.full_name || 'Dr').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();
  content.innerHTML = `
    <div class="modal-meta">
      <div class="modal-photo" aria-hidden="true">${initials}</div>
      <div>
        <h3>${normalizeDoctorName(doctor.full_name)}</h3>
        <p>${doctor.specialization}</p>
      </div>
    </div>
    <div class="modal-summary">
      <div>
        <label>Experience</label>
        <strong>${doctor.years_experience || 0} years</strong>
      </div>
      <div>
        <label>Rating</label>
        <strong>★★★★★ ${Number(doctor.avg_rating || 0).toFixed(1)}</strong>
      </div>
      <div>
        <label>Consultation</label>
        <strong>₹${Number(doctor.consultation_fee || 0).toFixed(0)}</strong>
      </div>
      <div>
        <label>Availability</label>
        <strong>Today</strong>
      </div>
    </div>
    <p>Dedicated care for ${doctor.specialization.toLowerCase()} patients, with practical scheduling and a patient-first experience at DK Hospital.</p>
    <button type="button" class="button button-primary wide-button" data-book-doctor="${doctor.doctor_id}">Book Appointment</button>
  `;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

async function showSignedIn() {
  document.body.classList.add('authenticated');
  const headerLogin = $('headerLogin');
  const headerLogout = $('headerLogout');
  const headerViewAppointments = $('headerViewAppointments');

  if (headerLogin) {
    headerLogin.style.display = 'none';
    headerLogin.classList.add('hidden');
  }
  if (headerViewAppointments) headerViewAppointments.style.display = 'inline-flex';
  if (headerLogout) {
    headerLogout.classList.remove('hidden');
    headerLogout.style.display = 'inline-flex';
  }

  if ($('heroStatus')) $('heroStatus').textContent = 'Patient access active';

  const logoutAction = () => {
    localStorage.removeItem('clinicToken');
    localStorage.removeItem('clinicRole');
    localStorage.removeItem('clinicUserName');
    location.reload();
  };

  if (headerLogout) headerLogout.onclick = logoutAction;

  const appointmentButton = $('headerViewAppointments');
  if (appointmentButton) appointmentButton.setAttribute('href', '/patient/dashboard.html');

  const nextAppointmentLine = $('nextAppointmentText');
  if (nextAppointmentLine) nextAppointmentLine.textContent = 'Loading upcoming appointment...';

  try {
    const appointments = await api('/appointments');
    const next = appointments.find((appointment) => appointment.status === 'booked');
    if (nextAppointmentLine) {
      nextAppointmentLine.textContent = next ? `${next.doctor_name} · ${next.appointment_date} · ${next.start_time}` : 'No upcoming appointments';
    }
  } catch {
    if (nextAppointmentLine) nextAppointmentLine.textContent = 'No upcoming appointments';
  }
}

async function load() {
  try {
    const [specs, doctors] = await Promise.all([api('/specializations'), api('/doctors')]);
    state.specializations = specs;
    state.doctors = doctors;
    fillSpecializationFilters();
    renderSpecializations();
    renderDoctors();
  } catch (error) {
    if ($('doctorList')) $('doctorList').innerHTML = '<p class="message">Doctor directory unavailable. Check the server and database.</p>';
    if ($('specializationsGrid')) $('specializationsGrid').innerHTML = '<p class="message">Specialization data unavailable right now.</p>';
  }
}

async function scheduleVisit() {
  if (!state.token) {
    $('scheduleMessage').textContent = 'Please sign in first.';
    return;
  }

  const specializationId = $('specialization').value;
  const preferredDate = $('date').value;
  if (!specializationId || !preferredDate) {
    $('scheduleMessage').textContent = 'Please choose a specialization and preferred date.';
    return;
  }

  try {
    let data;
    if (state.selectedDoctorId) {
      const slots = await api(`/availability/${state.selectedDoctorId}/${preferredDate}`);
      if (!slots.length) throw new Error('NO_DOCTOR_SLOT');
      const slot = slots[0];
      data = await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({ doctorId: state.selectedDoctorId, availabilityId: slot.availabilityId, appointmentDate: preferredDate, startTime: slot.startTime, endTime: slot.endTime })
      });
      const selectedDoctor = state.doctors.find((doctor) => doctor.doctor_id === state.selectedDoctorId);
      data = { ...data, doctorName: selectedDoctor?.full_name, specialization: selectedDoctor?.specialization, yearsExperience: selectedDoctor?.years_experience, consultationFee: selectedDoctor?.consultation_fee, score: 'Selected' };
    } else {
      data = await api('/smart-schedule', {
        method: 'POST',
        body: JSON.stringify({ specializationId, preferredDate })
      });
    }

    setMatchResult({
      score: data.score,
      doctorName: data.doctorName,
      specialization: data.specialization,
      appointmentDate: data.appointmentDate,
      startTime: data.startTime,
      yearsExperience: data.yearsExperience || 0,
      consultationFee: data.consultationFee || 0
    });
    $('scheduleMessage').textContent = state.selectedDoctorId ? 'Appointment confirmed with your selected doctor.' : 'Appointment confirmed.';
    $('scheduleMessage').style.color = '#0a4b4d';
  } catch (error) {
    $('scheduleMessage').textContent = error.message === 'NO_AVAILABLE_DOCTOR' || error.message === 'NO_DOCTOR_SLOT' ? 'Your selected doctor has no open slot on that date.' : error.message;
    $('scheduleMessage').style.color = '#dc6548';
  }
}

function bindEvents() {
  const headerLogin = $('headerLogin');
  if (headerLogin) {
    headerLogin.onclick = () => {
      window.location.href = '/login.html';
    };
  }

  const authForm = $('authForm');
  if (authForm) {
    authForm.onsubmit = async (event) => {
      event.preventDefault();
      try {
        const isDoctorRegistration = state.register && $('accountType') && $('accountType').value === 'doctor';
        const path = isDoctorRegistration ? '/auth/register-doctor' : (state.register ? '/auth/register' : '/auth/login');
        const body = { email: $('email').value, password: $('password').value };

        if (state.register) {
          Object.assign(body, {
            fullName: $('fullName').value,
            dateOfBirth: $('dob').value,
            phone: $('phone').value
          });

          if (isDoctorRegistration) {
            Object.assign(body, {
              specializationId: Number($('doctorSpecialization').value),
              licenseNo: $('licenseNo').value,
              yearsExperience: Number($('yearsExperience').value || 0),
              consultationFee: Number($('consultationFee').value || 700)
            });
          }
        }

        const data = await api(path, { method: 'POST', body: JSON.stringify(body) });
        if (location.pathname === '/doctor-login.html' && data.role !== 'doctor') {
          throw new Error('DOCTOR_ACCOUNT_REQUIRED');
        }
        state.token = data.token;
        localStorage.setItem('clinicToken', data.token);
        localStorage.setItem('clinicRole', data.role);
        localStorage.setItem('clinicUserName', state.register ? body.fullName || body.email : body.email || 'Patient');

        if (data.role === 'admin') { location.href = '/admin/dashboard.html'; return; }
        if (data.role === 'doctor') { location.href = '/doctor/dashboard.html'; return; }

        location.href = '/';
      } catch (error) {
        const messageBox = $('authMessage');
        messageBox.textContent = error.message === 'DATABASE_UNAVAILABLE' ? 'Database unavailable. Check .env and restart the server.' : error.message === 'DOCTOR_ACCOUNT_REQUIRED' ? 'Use a doctor account to enter the doctor workspace.' : error.message;
      }
    };
  }

  const scheduleButton = $('schedule');
  if (scheduleButton) scheduleButton.onclick = scheduleVisit;

  const specializationSelect = $('specialization');
  if (specializationSelect) specializationSelect.addEventListener('change', () => { state.selectedDoctorId = null; });

  const bookSelected = $('bookSelected');
  if (bookSelected) {
    bookSelected.onclick = scheduleVisit;
  }

  const menuToggle = $('menuToggle');
  const nav = document.querySelector('.primary-nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => nav.classList.toggle('is-open'));
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => nav.classList.remove('is-open')));
  }

  const toggleAuth = $('toggleAuth');
  if (toggleAuth) {
    toggleAuth.onclick = () => {
      state.register = !state.register;
      const title = $('authTitle');
      if (title) title.textContent = state.register ? 'Create your account' : 'Welcome back';
      toggleAuth.textContent = state.register ? 'I already have an account' : 'Create an account';
      syncRegisterFields();

      const doctorSpecialization = $('doctorSpecialization');
      const licenseNo = $('licenseNo');
      const yearsExperience = $('yearsExperience');
      const consultationFee = $('consultationFee');

      if (!state.register) {
        if (doctorSpecialization) doctorSpecialization.value = '';
        if (licenseNo) licenseNo.value = '';
        if (yearsExperience) yearsExperience.value = '';
        if (consultationFee) consultationFee.value = '';
      }
    };
  }

  const accountType = $('accountType');
  if (accountType) {
    accountType.addEventListener('change', () => {
      state.registerRole = accountType.value || 'patient';
      syncRegisterFields();
    });
  }

  const doctorList = $('doctorList');
  if (doctorList) {
    doctorList.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (!target) return;
      const doctorId = Number(target.dataset.doctorId);
      const doctor = state.doctors.find((item) => item.doctor_id === doctorId);
      if (!doctor) return;
      if (target.dataset.action === 'profile') openDoctorModal(doctor);
      if (target.dataset.action === 'schedule') {
        state.selectedDoctorId = doctor.doctor_id;
        $('specialization').value = state.specializations.find((s) => s.name === doctor.specialization)?.specialization_id || $('specialization').value;
        setMatchResult({
          score: '92',
          doctorName: doctor.full_name,
          specialization: doctor.specialization,
          appointmentDate: $('date').value,
          startTime: '09:00 AM',
          yearsExperience: doctor.years_experience,
          consultationFee: doctor.consultation_fee,
          doctor: doctor
        });
        document.querySelector('#scheduler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!state.token) {
          $('scheduleMessage').textContent = 'Please sign in first to book this doctor.';
        } else {
          $('scheduleMessage').textContent = `${normalizeDoctorName(doctor.full_name)} selected. Choose a date, then click “Book this doctor”.`;
        }
      }
    });
  }

  const modal = $('doctorModal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target.matches('[data-close-modal="true"]')) closeDoctorModal();
      if (event.target.matches('[data-book-doctor]')) {
        const doctorId = Number(event.target.dataset.bookDoctor);
        const doctor = state.doctors.find((item) => item.doctor_id === doctorId);
        if (doctor) {
          state.selectedDoctorId = doctor.doctor_id;
          $('specialization').value = state.specializations.find((s) => s.name === doctor.specialization)?.specialization_id || $('specialization').value;
          closeDoctorModal();
          document.querySelector('#scheduler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (!state.token) { $('scheduleMessage').textContent = 'Please sign in to confirm this booking.'; return; }
          scheduleVisit();
        }
      }
    });
  }

  const searchInput = $('doctorSearch');
  if (searchInput) searchInput.addEventListener('input', renderDoctors);
  const specialtyFilter = $('specialityFilter');
  if (specialtyFilter) specialtyFilter.addEventListener('change', renderDoctors);
  const doctorSort = $('doctorSort');
  if (doctorSort) doctorSort.addEventListener('change', renderDoctors);

  const signOutButton = $('signOut');
  if (signOutButton) {
    signOutButton.onclick = () => {
      localStorage.removeItem('clinicToken');
      localStorage.removeItem('clinicRole');
      localStorage.removeItem('clinicUserName');
      signOutButton.classList.add('hidden');
      location.reload();
    };
  }

  const headerLogout = $('headerLogout');
  if (headerLogout) {
    headerLogout.onclick = () => {
      localStorage.removeItem('clinicToken');
      localStorage.removeItem('clinicRole');
      localStorage.removeItem('clinicUserName');
      headerLogout.classList.add('hidden');
      location.reload();
    };
  }
}

function init() {
  document.body.classList.toggle('authenticated', Boolean(state.token));
  const savedRole = localStorage.getItem('clinicRole');
  if (state.token && location.pathname === '/' && savedRole === 'admin') location.replace('/admin/dashboard.html');
  if (state.token && location.pathname === '/' && savedRole === 'doctor') location.replace('/doctor/dashboard.html');

  setDate();
  bindEvents();
  syncRegisterFields();
  load();
  if (state.token) showSignedIn();
}

init();
