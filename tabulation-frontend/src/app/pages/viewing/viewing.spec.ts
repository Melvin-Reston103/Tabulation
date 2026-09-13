import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Viewing } from './viewing';

describe('Viewing', () => {
  let component: Viewing;
  let fixture: ComponentFixture<Viewing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Viewing],
    }).compileComponents();

    fixture = TestBed.createComponent(Viewing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
