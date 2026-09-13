import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HighSchoolDepartment } from './high-school-department';

describe('HighSchoolDepartment', () => {
  let component: HighSchoolDepartment;
  let fixture: ComponentFixture<HighSchoolDepartment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HighSchoolDepartment],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HighSchoolDepartment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
