import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CollegeDepartment } from './college-department';

describe('CollegeDepartment', () => {
  let component: CollegeDepartment;
  let fixture: ComponentFixture<CollegeDepartment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollegeDepartment],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CollegeDepartment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
