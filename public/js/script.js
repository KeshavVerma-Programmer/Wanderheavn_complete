(() => {
  'use strict';

  // 🌍 Full-page loading spinner
  window.addEventListener('load', () => {
    const fullPageSpinner = document.getElementById('fullPageSpinner');
    if (fullPageSpinner) {
      setTimeout(() => {
        fullPageSpinner.style.display = 'none';
      }, 100); // Hide after 2 seconds
    }
  });

  // 📝 Form submission spinner
  const forms = document.querySelectorAll('.needs-validation');

  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        event.preventDefault(); // Prevent form submission temporarily
        
        // Show form spinner
        const formSpinner = document.getElementById('formSpinner');
        if (formSpinner) formSpinner.style.display = 'block';

        // Hide form spinner after 2 seconds and submit the form
        setTimeout(() => {
          if (formSpinner) formSpinner.style.display = 'none';
          form.submit();
        }, 1000);
      }

      form.classList.add('was-validated');
    }, false);
  });
})();
