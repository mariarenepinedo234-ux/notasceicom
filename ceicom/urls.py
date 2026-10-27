from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path
from academics import views

admin.site.site_header = 'CEICOM · Administración académica'
admin.site.site_title = 'CEICOM'
admin.site.index_title = 'Catálogos y expedientes'
urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', auth_views.LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('password/', auth_views.PasswordChangeView.as_view(template_name='password.html', success_url='/'), name='password'),
    path('', views.dashboard, name='dashboard'),
    path('materia/<int:pk>/', views.gradebook, name='gradebook'),
    path('consulta/<int:pk>/', views.toggle_visibility, name='toggle_visibility'),
    path('traslado/<int:pk>/', views.transfer, name='transfer'),
    path('planilla/<int:pk>/', views.export_grades, name='export_grades'),
]
