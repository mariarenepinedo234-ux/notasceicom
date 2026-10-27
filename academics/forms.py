from django import forms
from .models import SHIFTS

class GradebookForm(forms.Form):
    reason = forms.CharField(label='Motivo de corrección (obligatorio al cambiar una nota publicada)', required=False, widget=forms.Textarea(attrs={'rows':2}))
    def __init__(self, *args, registrations, administrator=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.registrations = registrations
        for row in registrations:
            locked = row.published and not administrator
            self.fields[f'grade_{row.pk}'] = forms.DecimalField(label=f'Nota de {row.enrollment.student}', min_value=1, max_value=100, max_digits=5, decimal_places=2, required=False, initial=row.grade, disabled=locked)
            self.fields[f'publish_{row.pk}'] = forms.BooleanField(label='Publicar', required=False, initial=row.published, disabled=locked)
    def clean(self):
        cleaned = super().clean()
        correction = False
        for row in self.registrations:
            grade = cleaned.get(f'grade_{row.pk}')
            published = cleaned.get(f'publish_{row.pk}', False)
            if published and grade is None:
                self.add_error(f'grade_{row.pk}', 'Ingresa una nota antes de publicarla.')
            if row.published and (grade != row.grade or published != row.published): correction = True
        if correction and not cleaned.get('reason', '').strip():
            self.add_error('reason', 'Indica el motivo de la corrección de una nota publicada.')
        return cleaned

class TransferForm(forms.Form):
    shift = forms.ChoiceField(label='Nuevo turno', choices=SHIFTS)
    reason = forms.CharField(label='Motivo del traslado', widget=forms.Textarea(attrs={'rows':3}), max_length=1000)

class VisibilityForm(forms.Form):
    reason = forms.CharField(label='Motivo', max_length=1000, widget=forms.Textarea(attrs={'rows':2}))
