(() => {
  'use strict';

  window.addEventListener('load', () => {
    const fullPageSpinner = document.getElementById('fullPageSpinner');
    if (fullPageSpinner) {
      setTimeout(() => {
        fullPageSpinner.style.display = 'none';
      }, 100); 
    }
  });

  const forms = document.querySelectorAll('.needs-validation');

  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        event.preventDefault(); 
        
        const formSpinner = document.getElementById('formSpinner');
        if (formSpinner) formSpinner.style.display = 'block';

        setTimeout(() => {
          if (formSpinner) formSpinner.style.display = 'none';
          form.submit();
        }, 1000);
      }

      form.classList.add('was-validated');
    }, false);
  });
})();
